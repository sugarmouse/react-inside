import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher, Dispatch } from 'react/src/currentDispatcher';
import {
  Update,
  UpdateQueue,
  basicStateReducer,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue
} from './updateQueue';
// import currentBatchConfig from 'react/src/currentBatchConfig';
import { Action, ReactContextType, Thenable, Usable } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import {
  Lane,
  NoLane,
  NoLanes,
  mergeLanes,
  removeLanes,
  requestUpdateLane
} from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';
import { trackUsedThenabel as trackUsedThenable } from './thenable';
import { REACT_CONTEXT_TYPE } from 'shared/ReactSymbols';
import { markWipReceivedUpdate } from './beginWork';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher, currentBatchConfig } = internals;

// 保存每一个 hook 对应的状态
interface Hook {
  baseState: any;
  memoizedState: any;
  updateQueue: unknown;
  baseQueue: Update<any> | null;
  next: Hook | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
  lastRenderedState: State;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export interface Effect {
  tag: Flags;
  destroy: EffectCallback | void;
  create: EffectCallback | void;
  deps: EffectDeps;
  // 指向下一个 effect hook, 为了遍历 effect hooks 的时候可以直接遍历到 effect hook
  // 而不是需要到每一个 hook 判断一次 hook 的种类
  next: Effect | null;
}

// for function component in beginWork
export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 拿到当前 FiberNode
  currentlyRenderingFiber = wip;
  // 重置 hook 链表
  wip.memoizedState = null;
  // 重置 effect 链s表
  wip.updateQueue = null;

  renderLane = lane;

  const current = wip.alternate;

  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  renderLane = NoLane;
  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
  useTransition: mountTransition,
  useRef: mountRef,
  useContext: readContext,
  use: use
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition,
  useRef: udpateRef,
  useContext: readContext,
  use: use
};

function readContext<T>(context: ReactContextType<T>): T {
  const consumer = currentlyRenderingFiber;
  if (consumer === null) {
    throw new Error('useContext can only invoked in a function component');
  }
  const value = context._currentValue;
  return value;
}

function mountRef<T>(initValue: T): { current: T } {
  const hook = mountWorkInProgressHook();
  const ref = { current: initValue };
  hook.memoizedState = ref;
  return ref;
}

function udpateRef<T>(): { current: T } {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;
}

function mountTransition(): [boolean, (callback: () => void) => void] {
  const [isPending, setPending] = mountState(false);
  const hook = mountWorkInProgressHook();
  const start = startTransition.bind(null, setPending);
  hook.memoizedState = start;
  return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [isPending] = updateState();
  const hook = updateWorkInProgressHook();
  const start = hook.memoizedState;
  return [isPending as boolean, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
  setPending(true);

  const prevTransition = currentBatchConfig.transition;
  currentBatchConfig.transition = 1;

  callback();
  setPending(false);

  currentBatchConfig.transition = prevTransition;
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

  hook.memoizedState = pushEffect(
    Passive | HookHasEffect, // mount 阶段，effect 需要触发
    create,
    undefined,
    nextDeps
  );
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallback | void;

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect;
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      // 比较依赖
      const prevDeps = prevEffect.deps;
      // 依赖相同
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // 浅比较 不相等
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memoizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
  if (prevDeps === null || nextDeps === null) {
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
) {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null
  };

  const fiber = currentlyRenderingFiber as FiberNode;
  // FCUpdateQueue.lastEffect 保存 Effect 环状链表
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    // 第一个
    const updateQueue = createFCUpdateQueue();
    fiber.updateQueue = updateQueue;
    effect.next = effect; // 指向自身
    updateQueue.lastEffect = effect;
  } else {
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      // 环状链表插入新的 effect
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前 useState 对应的 hook 数据
  const hook = updateWorkInProgressHook();

  // 计算新的 state
  const queue = hook.updateQueue as FCUpdateQueue<State>;
  const baseState = hook.baseState;

  const pendingUpdate = queue.shared.pending;
  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;

  if (pendingUpdate !== null) {
    if (baseQueue !== null) {
      // 将 baseQueue 和 pendingUpdate 合并
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingUpdate.next;
      baseQueue.next = pendingFirst;
      pendingUpdate.next = baseFirst;
    }

    baseQueue = pendingUpdate;

    current.baseQueue = pendingUpdate;
    queue.shared.pending = null;
  }

  if (baseQueue !== null) {
    const prevState = hook.memoizedState;
    const {
      memoizedState,
      baseQueue: newBaseQueue,
      baseState: newBaseState
    } = processUpdateQueue(
      baseState,
      baseQueue,
      renderLane,
      (skippedUpdate) => {
        const skippedLane = skippedUpdate.lane;
        const fiber = currentlyRenderingFiber as FiberNode;
        // 在 beginWork 的时候 fiber.lanes 被重置为 NoLanes
        fiber.lanes = mergeLanes(fiber.lanes, skippedLane);
      }
    );

    // bailout
    if (!Object.is(prevState, memoizedState)) {
      if (__DEV__) {
        console.warn('prevState and curState is Same');
      }
      markWipReceivedUpdate();
    }

    hook.memoizedState = memoizedState;
    hook.baseQueue = newBaseQueue;
    hook.baseState = newBaseState;

    queue.lastRenderedState = memoizedState;
  }

  // 返回新的 state 和 dispatch
  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function mountState<State>(
  initialState: State | (() => State)
): [State, Dispatch<State>] {
  // 找到当前 useState 对应的 hook 数据
  const hook = mountWorkInProgressHook();
  // 获取初始状态
  let memoizedState: State;
  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  // 创建更新队列
  const queue = createFCUpdateQueue<State>();
  // 填充 hook 字段
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState;
  hook.baseState = memoizedState;

  if (currentlyRenderingFiber === null) {
    throw new Error('Hooks can only be called in a React function component');
  }

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;

  queue.lastRenderedState = memoizedState;
  return [memoizedState, dispatch];
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: FCUpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLane();
  const update = createUpdate<State>(action, lane);

  // eager state 策略
  const current = fiber.alternate;
  if (
    fiber.lanes === NoLanes &&
    (current === null || current.lanes === NoLanes)
  ) {
    // 当前产生的 update 是当前 fiber 的第一个 update
    const currentState = updateQueue.lastRenderedState;
    const eagerState = basicStateReducer(currentState, action);
    update.hasEagerState = true;
    update.eagerState = eagerState;

    if (Object.is(currentState, eagerState)) {
      // 命中 eagerState
      enqueueUpdate(updateQueue, update, fiber, NoLane);
      if (__DEV__) {
        console.warn('fiber triggered eagerState', fiber);
      }
      return;
    }
  }

  enqueueUpdate(updateQueue, update, fiber, lane);
  scheduleUpdateOnFiber(fiber, lane);
}

/**
 * 维护 hooks 的链表结构，用 fiberNode 的 memorizedState 指向第一个 hook
 * @returns 一个新的 hook
 */
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
    baseQueue: null,
    baseState: null
  };

  if (workInProgressHook === null) {
    // mount 时 第一个 hook
    if (currentlyRenderingFiber === null) {
      throw new Error('Hooks can only be called in a React function component');
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount 时后续的 hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }

  return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
  // TODO: render 阶段调用 dispatch 函数触发的更新

  // 复用之前的 hook
  let nextCurrentHook: Hook | null;
  if (currentHook === null) {
    // mount 时 第一个 hook
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      // update
      nextCurrentHook = current?.memoizedState;
    } else {
      // update 阶段但是没有对应的 fiber
      // 是错误情况，复制为 null，之后在下面的边界条件处理
      nextCurrentHook = null;
    }
  } else {
    // mount 时后续的 hook
    nextCurrentHook = currentHook.next;
  }

  // 处理边界条件
  if (nextCurrentHook === null) {
    // 上一次：hook1, hook2
    // 下一次：hook1, hook2, hook3
    throw new Error('hooks can not be used in conditional branches');
  }

  // 根据旧的 hook 创建一个新的 hook
  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null,
    baseQueue: currentHook.baseQueue,
    baseState: currentHook.baseState
  };

  // 维护 hooks 的链表结构
  if (workInProgressHook === null) {
    // update 时 第一个 hook
    if (currentlyRenderingFiber === null) {
      throw new Error('Hooks can only be called in a React function component');
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // update 时后续的 hook
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }

  return workInProgressHook;
}

function use<T>(usable: Usable<T>): T {
  if (usable !== null && typeof usable === 'object') {
    if (typeof (usable as Thenable<T>).then === 'function') {
      // This is a thenable.
      const thenable = usable as Thenable<T>;
      return trackUsedThenable(thenable);
    } else if (
      (usable as ReactContextType<T>).$$typeof === REACT_CONTEXT_TYPE
    ) {
      const context = usable as ReactContextType<T>;
      return readContext(context);
    }
  }

  throw new Error('An unsupported type was passed to use(): ' + String(usable));
}

export function resetHooksOnUnwind(wip: FiberNode) {
  currentlyRenderingFiber = null;
  currentHook = null;
  workInProgressHook = null;
}

export function bailoutHook(wip: FiberNode, renderLane: Lane) {
  const current = wip.alternate as FiberNode;
  wip.updateQueue = current.updateQueue;
  wip.flags &= ~PassiveEffect;

  current.lanes = removeLanes(current.lanes, renderLane);
}
