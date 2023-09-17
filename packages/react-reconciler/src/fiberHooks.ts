import internals from 'shared/internals';
import { FiberNode } from './fiber';

let currentlyRenderingFiber: FiberNode | null = null;
const workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;

// 保存每一个 hook 对应的状态
interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
  // 拿到当前 FiberNode
  currentlyRenderingFiber = wip;
  wip.memoizedState = null;

  const current = wip.alternate;

  if (current !== null) {
    // update
  } else {
    // mount
    // get currentDispatcher.current
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 清空当前 FiberNode
  currentlyRenderingFiber = null;

  return children;
}
