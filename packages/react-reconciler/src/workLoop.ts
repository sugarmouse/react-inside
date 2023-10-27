import { sheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitLayoutEffects,
  commitMutationEffects
} from './commitWorks';
import { completeWork } from './completeWork';
import {
  FiberNode,
  FiberRootNode,
  PendingPassiveEffects,
  createWorkInProgress
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import { flushSyncCallbackQueue, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
  unstable_NormalPriority as NormalPriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_cancelCallback as cancelCallback,
  unstable_shouldYield as shouldYield
} from 'scheduler';
import {
  Lane,
  NoLane,
  SyncLane,
  getNextLane,
  lanesToSchedulerPriority,
  markRootFinished,
  markRootSuspended,
  mergeLanes
} from './fiberLanes';
import { HookHasEffect, Passive } from './hookEffectTags';
import { SuspenseException, getSuspenseThenable } from './thenable';
import { resetHooksOnUnwind } from './fiberHooks';
import { throwException } from './fiberThrow';
import { unwindWork } from './fiberUnwindWork';

type RootExistStatus = number;

const RootInProgress: RootExistStatus = 0;
const RootInComplete: RootExistStatus = 1; // concurrent render interupted status
const RootCompleted: RootExistStatus = 2;
const RootDidNotComplete: RootExistStatus = 3; // render root suspense status
// TODO: 执行过程中报错状态

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
// 为了阻止多次调用 commitRoot 时，多次调度副作用
let rootDoesHasPassiveEffects: boolean = false;

let wipRootExistStatus: RootExistStatus = RootInProgress;

// for  suspended
type SuspendedReason = 0 | 2;
const NotSuspended: SuspendedReason = 0;
const SuspendedOnData: SuspendedReason = 2;
let wipSuspendedReason: SuspendedReason = NotSuspended;
let wipThrowValue: any = null;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  //create wip HostRootFiber
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;

  wipRootExistStatus = RootInProgress;
  wipSuspendedReason = NotSuspended;
  wipThrowValue = null;
}

// 触发更新入口
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateFromFiberToRoot(fiber);
  if (root === null) {
    console.warn(
      'schduleUpdateOnFiber error:can not find FiberRootNode, FiberRootNode is null'
    );
    return;
  }
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

// 调度阶段的入口
export function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getNextLane(root);
  const existingCallback = root.callbackNode;

  if (updateLane === NoLane) {
    // 没有更新
    if (existingCallback !== null) {
      cancelCallback(existingCallback);
    }
    root.callbackPriority = NoLane;
    root.callbackNode = null;
    return;
  }
  const curPriority = updateLane;
  const prvePriority = root.callbackPriority;

  // 相同优先级不需要产生新的调度
  if (curPriority === prvePriority) {
    return;
  }

  if (existingCallback !== null) {
    cancelCallback(existingCallback);
  }

  let newCallbackNode = null;

  if (updateLane === SyncLane) {
    // 微任务调度
    scheduleSyncCallback(performSyncOnRoot.bind(null, root));
    sheduleMicroTask(flushSyncCallbackQueue);
  } else {
    // 其他优先级调度
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      performConcurrentOnRoot.bind(null, root)
    );
  }

  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

export function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// find FiberRootNode from the fiberNode passed in
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = fiber.return;
  while (parent !== null) {
    node = parent;
    parent = parent.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode as FiberRootNode;
  }
  return null;
}

// 并发 render 阶段的入口
function performConcurrentOnRoot(
  root: FiberRootNode,
  didTimeout: boolean
): any {
  const curCallback = root.callbackNode;
  // 在并发执行之前要保证所有的 useEffect 都已经执行
  const didFlushPassiveEffects = flushPassiveEffects(
    root.pendingPassiveEffects
  );
  // 在执行 useEffect 过程中产生了更高优先级的任务
  if (didFlushPassiveEffects) {
    if (root.callbackNode !== curCallback) {
      return null;
    }
  }

  const lane = getNextLane(root);
  const curNode = root.callbackNode;
  if (lane === NoLane) {
    return null;
  }
  const needSync = lane === SyncLane || didTimeout;
  // render 阶段
  const existStatus = renderRoot(root, lane, !needSync);

  switch (existStatus) {
    case RootCompleted:
      // 当前任务更新结束,重置操作
      const finishedWork = root.current.alternate;
      root.finishedWork = finishedWork;
      root.finishedLane = lane;
      wipRootRenderLane = NoLane;
      commitRoot(root);
      break;

    case RootInComplete:
      // 中断
      if (root.callbackNode !== curNode) {
        // 有更高优先级的任务插入进来
        return;
      }
      // 没有更高优先级的任务插入进来,继续执行上一次中断的任务
      return performConcurrentOnRoot.bind(null, root, didTimeout);

    case RootDidNotComplete:
      markRootSuspended(root, lane);
      ensureRootIsScheduled(root);
      break;

    default:
      console.warn(`unhandled render existStatus in performSyncOnRoot`);
  }
}

// 同步 render 阶段的入口
function performSyncOnRoot(root: FiberRootNode) {
  // initialize

  const nextLane = getNextLane(root);
  if (nextLane !== SyncLane) {
    // NoLane
    // 或者其他优先级低的 lane
    ensureRootIsScheduled(root);
    return;
  }

  const existStatus = renderRoot(root, nextLane, false);

  switch (existStatus) {
    case RootCompleted:
      const finishedWork = root.current.alternate;
      root.finishedWork = finishedWork;
      root.finishedLane = nextLane;
      wipRootRenderLane = NoLane;
      commitRoot(root);
      break;

    case RootDidNotComplete:
      wipRootRenderLane = NoLane;
      markRootSuspended(root, nextLane);
      ensureRootIsScheduled(root);
      break;

    default:
      if (__DEV__) {
        console.warn(`unhandled render existStatus in performSyncOnRoot`);
      }
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`开始 ${shouldTimeSlice ? '并发' : '同步'} 更新`);
  }

  if (wipRootRenderLane !== lane) {
    // init
    prepareFreshStack(root, lane);
  }

  do {
    try {
      if (wipSuspendedReason !== NotSuspended && workInProgress !== null) {
        const throwValue = wipThrowValue;
        // reset
        wipSuspendedReason = NotSuspended;
        wipThrowValue = null;
        // unwind
        throwAndUnwindWorkLoop(root, workInProgress, throwValue, lane);
      }

      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      handleThrow(root, e);
    }
  } while (true);

  if (wipRootExistStatus !== RootInProgress) {
    return wipRootExistStatus;
  }

  // 中断执行 || render 执行完
  if (shouldTimeSlice && workInProgress !== null) {
    console.log('中断执行');
    // 中断执行
    return RootInComplete;
  }

  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error(
      'renderRoot loop error: workInProgress should be null when loop over and not shouldTimeSlice'
    );
  }

  // TODO: loop 报错处理

  return RootCompleted;
}

function throwAndUnwindWorkLoop(
  root: FiberRootNode,
  unitOfWork: FiberNode,
  throwValue: any,
  lane: Lane
) {
  // 重置 function component 全局变量
  resetHooksOnUnwind(unitOfWork);
  // 请求返回后触发更新
  // 给距离最近的 Suspense fiberNode 标记 ShouldCapture
  throwException(root, throwValue, lane);
  // unwind
  unwindUnitOfWork(unitOfWork);
}

// 拿到距离 unitOfWork 最近的 Suspense fiberNode
function unwindUnitOfWork(unitOfWork: FiberNode) {
  let incompleteWork: FiberNode | null = unitOfWork;

  do {
    // check if incompleteWork is the suspense fiber tagged with ShouldCapture
    // if it is, then remove ShouldCapture and tag DidCapture
    const next = unwindWork(incompleteWork);

    if (next !== null) {
      workInProgress = next;
      return;
    }

    const returnFiber = incompleteWork.return as FiberNode;
    if (returnFiber !== null) {
      // 清楚之前 beginWork 留下的副作用
      returnFiber.deletions = null;
    }
    incompleteWork = returnFiber;
  } while (incompleteWork !== null);

  // 使用了 use， 但是没有 Suspense 包裹
  wipRootExistStatus = RootDidNotComplete;
  workInProgress = null;
}

// for handle Error Boundary and self-defined Exception
function handleThrow(root: FiberRootNode, throwValue: any) {
  if (throwValue === SuspenseException) {
    // Suspense
    throwValue = getSuspenseThenable();
    wipSuspendedReason = SuspendedOnData;
  } else {
    // TODO: unhandled error, like Error Boundary
    if (__DEV__) {
      console.warn('renderRoot loop catched an unhandled error: ', throwValue);
    }
  }
  wipThrowValue = throwValue;
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;
  const lane = root.finishedLane;

  if (finishedWork === null) return;

  if (__DEV__) {
    console.warn('commit work starting...');
  }

  // 重置
  root.finishedWork = null;
  root.finishedLane = NoLane;
  markRootFinished(root, lane);

  // 在 commit 之前，先处理函数组件的 useEffect
  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subTreeFlags & PassiveMask) !== NoFlags
  ) {
    // 当前组件树存在函数组件需要执行 useEffect 回调
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;
      // 开始调度副作用
      scheduleCallback(NormalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects);
        // TODO: 这里的 return 有作用
        return;
      });
    }
  }

  // 判断是否存在 3 个子阶段需要执行操作
  const subtreeHasEffects =
    (finishedWork.subTreeFlags & (MutationMask | PassiveMask)) !== NoFlags;
  const rootHasEffects =
    (finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags;

  if (subtreeHasEffects || rootHasEffects) {
    // beforeMutation
    // mutation Placement

    commitMutationEffects(finishedWork, root);
    root.current = finishedWork; // 双缓存机制的 fiber 树切换
    if (__DEV__) {
      console.warn('commit mutation 结束，fiber 树已翻转');
    }
    // layout
    commitLayoutEffects(finishedWork, root);
  } else {
    root.current = finishedWork;
  }

  // 重置
  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

// 执行副作用
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffects = false;
  if (__DEV__) {
    console.warn(
      'flushPassiveEffects with pendingPassiveEffects',
      pendingPassiveEffects
    );
  }
  // 执行卸载组件的 destroy effects
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffects = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  // 执行组件更新的 上一次注册的 destroy effect
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffects = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });

  // 执行本次更新注册的 create effect，并且更新 destroy 函数
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffects = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];

  // useEffect 过程中也可能触发新的同步更新
  flushSyncCallbackQueue();
  return didFlushPassiveEffects;
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane);
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  do {
    completeWork(node);
    const sibling = node.sibling;
    // 如果有兄弟节点，则 sibling 给 wip
    // 之后回到 workloop 中，继续从 sibling开始往下走
    // 生成子节点，返回子节点
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    // 没有 sibling 就往父节点走
    // 对每一个节点执行 completeWork
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
