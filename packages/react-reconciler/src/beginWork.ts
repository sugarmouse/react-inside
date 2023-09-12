import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import { HostComponent, HostRoot, HostText } from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';

// dfs forward
// compare ReactElement with fiber node
// and return child fiber node
export const beginWork = (wip: FiberNode) => {
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      return null;
    default:
      if (__DEV__) {
        console.warn(`beginWork unimplemented tag: ${wip.tag}`);
      }
      break;
  }
  return null;
};

// update state
// craete child fiberNode
function updateHostRoot(wip: FiberNode) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  // clear pending update
  updateQueue.shared.pending = null;
  const { memoizedState } = processUpdateQueue(baseState, pending);
  wip.memoizedState = memoizedState;

  const nextChildren = wip.memoizedState;

  reconcileChildren(wip, nextChildren);
  return wip.child;
}

// craete child fiberNode
// no update trigger
function updateHostComponent(wip: FiberNode) {
  const nextPros = wip.pendingProps;
  const nextChildren = nextPros.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  const current = wip.alternate;
  if (current !== null) {
    //  update
    wip.child = reconcileChildFibers(current, current?.child, children);
  } else {
    // mount
    // no side effect track
    wip.child = mountChildFibers(wip, null, children);
  }
}
