import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher, Dispatch } from 'react/src/currentDispatcher';
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { requestUpdateLanes } from './fiberLanes';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

const { currentDispatcher } = internals;

// 保存每一个 hook 对应的状态
interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

// for function component in beginWork
export function renderWithHooks(wip: FiberNode) {
  // 拿到当前 FiberNode
  currentlyRenderingFiber = wip;
  // 重置
  wip.memoizedState = null;

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

  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState
};

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前 useState 对应的 hook 数据
  const hook = updateWorkInProgressHook();

  // 计算新的 state
  const queue = hook.updateQueue as UpdateQueue<State>;
  const pendingUpdate = queue.shared.pending;
  if (pendingUpdate !== null) {
    const { memoizedState } = processUpdateQueue(
      hook.memoizedState,
      pendingUpdate
    );
    hook.memoizedState = memoizedState;
  }

  // 返回新的 state 和 dispatch
  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function mountState<State>(
  initialState: State | (() => State)
): [State, Dispatch<State>] {
  // 找到当前 useState 对应的 hook 数据
  const hook = mountWorkInProgress();
  // 获取初始状态
  let memoizedState: State;
  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  // 创建更新队列
  const queue = createUpdateQueue<State>();
  // 填充 hook 字段
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState;

  if (currentlyRenderingFiber === null) {
    throw new Error('Hooks can only be called in a React function component');
  }

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;
  return [memoizedState, dispatch];
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLanes();
  const update = createUpdate<State>(action, lane);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber);
}

/**
 * 维护 hooks 的链表结构，用 fiberNode 的 memorizedState 指向第一个 hook
 * @returns 一个新的 hook
 */
function mountWorkInProgress(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null
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
    next: null
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
