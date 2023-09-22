import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  Fragment
} from './workTags';

/**
 * 在 mount 阶段，根据 child ReactElement 创建 child FiberNode，并挂在 wip.child 上
 * @param {FiberNode} wip
 * @returns child FiberNode
 */
export const beginWork = (wip: FiberNode) => {
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip);
    case Fragment:
      return updateFragment(wip);
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

function updateFunctionComponent(wip: FiberNode) {
  const nextChildren = renderWithHooks(wip);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

// 根据当前 fiber 节点和当前 child reactElement 创建 wip.child
function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  const current = wip.alternate;
  if (current !== null) {
    //  update
    // HostRootFiber 的 alternative 有指向的双缓存节点
    // 所以 react 第一次启动的时候， hostRootFiber 会走这个逻辑
    // 因此 hostRootFiber 会被打上 Placement 标记
    wip.child = reconcileChildFibers(wip, current?.child, children);
  } else {
    // mount
    // no side effect track
    wip.child = mountChildFibers(wip, null, children);
  }
}
