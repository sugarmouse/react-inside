import { sheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
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
  unstable_scheduleCallback as scheduleCallback
} from 'scheduler';
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  markRootFinished,
  mergeLanes
} from './fiberLanes';
import { HookHasEffect, Passive } from './hookEffectTags';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
// 为了阻止多次调用 commitRoot 时，多次调度副作用
let rootDoesHasPassiveEffects: boolean = false;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  //create wip HostRootFiber
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
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
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  if (updateLane === NoLane) {
    // 没有更新
    return;
  }

  if (updateLane === SyncLane) {
    // 微任务调度
    scheduleSyncCallback(performSyncOnRoot.bind(null, root, updateLane));
    sheduleMicroTask(flushSyncCallbackQueue);
  } else {
    // 其他优先级调度
  }
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
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

// 同步 render 阶段的入口
function performSyncOnRoot(root: FiberRootNode, lane: Lane) {
  // initialize

  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // NoLane
    // 或者其他优先级低的 lane
    ensureRootIsScheduled(root);
    return;
  }
  root.pendingLanes = nextLane;
  prepareFreshStack(root, lane);

  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn(`workLoop error: ${e}`);
      }
      workInProgress = null;
    }
  } while (true);
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLane = lane;
  wipRootRenderLane = NoLane;
  commitRoot(root);
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
    // layout
  } else {
    root.current = finishedWork;
  }

  // 重置
  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

// 执行副作用
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  if (__DEV__) {
    console.warn(
      'flushPassiveEffects with pendingPassiveEffects',
      pendingPassiveEffects
    );
  }
  // 执行卸载组件的 destroy effects
  pendingPassiveEffects.unmount.forEach((effect) => {
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  // 执行组件更新的 上一次注册的 destroy effect
  pendingPassiveEffects.update.forEach((effect) => {
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });

  // 执行本次更新注册的 create effect，并且更新 destroy 函数
  pendingPassiveEffects.update.forEach((effect) => {
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];

  // useEffect 过程中也可能触发新的同步更新
  flushSyncCallbackQueue();
}

function workLoop() {
  while (workInProgress !== null) {
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
