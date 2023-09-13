import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode) {
  //create hostROotFiber
  workInProgress = createWorkInProgress(root.current, {});
}

export function schduleUpdateOnFiber(fiber: FiberNode) {
  // TODO shcdule function
  const root = markUpdateFromFiberToRoot(fiber);
  if (root === null) {
    console.warn(
      'schduleUpdateOnFiber error:can not find FiberRootNode, FiberRootNode is null'
    );
    return;
  }
  renderRoot(root);
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

function renderRoot(root: FiberRootNode) {
  // initialize
  prepareFreshStack(root);

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
  commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;
  root.finishedWork = null;

  if (finishedWork === null) return;

  if (__DEV__) {
    console.warn('commit work starting...');
  }

  // 判断是否存在 3 个子阶段需要执行操作
  const subtreeHasEffects =
    (finishedWork.subTreeFlags & MutationMask) !== NoFlags;
  const rootHasEffects = (finishedWork.flags & MutationMask) != NoFlags;

  if (subtreeHasEffects || rootHasEffects) {
    // beforeMutation
    // mutation Placement

    root.current = finishedWork; // 双缓存机制的 fiber 树切换
    // layout
  } else {
    root.current = finishedWork;
  }
}

function workLoop() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber);
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
    if (sibling !== null) {
      workInProgress = sibling;
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
