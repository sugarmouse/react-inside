import { ReactElementType, ReactProviderType } from 'shared/ReactTypes';
import {
  FiberNode,
  OffscreenProps,
  createFiberFromFragment,
  createFiberFromOffscreen,
  createWorkInProgress
} from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
  cloneChildFibers,
  mountChildFibers,
  reconcileChildFibers
} from './childFibers';
import { bailoutHook, renderWithHooks } from './fiberHooks';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  Fragment,
  ContextProvider,
  SuspenseComponent,
  OffscreenComponent,
  MemoComponent
} from './workTags';
import { Lane, NoLanes, includeSomeLanes } from './fiberLanes';
import {
  ChildDeletion,
  DidCapture,
  NoFlags,
  Placement,
  Ref
} from './fiberFlags';
import {
  prepareToReadContext,
  propagateContextChange,
  pushProvider
} from './fiberContext';
import { pushSuspenseHandler } from './suspenseContext';
import { shallowEquals } from 'shared/shallowEquals';

// 是否命中 bailout 优化策略
let didReceiveUpdate = false;
export function markWipReceivedUpdate() {
  didReceiveUpdate = true;
}

/**
 * 在 mount 阶段，根据 child ReactElement 创建 child FiberNode，并挂在 wip.child 上
 * @param {FiberNode} wip
 * @returns child FiberNode
 */
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  // bailout, 命中优化策略，不需要从 reconciler 生成子节点
  // 判断是否命中的标准，props, state, update, type of fiberNode
  const current = wip.alternate;
  didReceiveUpdate = false;

  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = wip.pendingProps;

    if (oldProps !== newProps || current.type !== wip.type) {
      // props and type
      didReceiveUpdate = true;
    } else {
      // context and state
      const hasScheduledStateOrContext = checkScheduleUpdateOrContext(
        current,
        renderLane
      );
      if (!hasScheduledStateOrContext) {
        // 命中四要素
        // trigger bailout
        didReceiveUpdate = false;
        switch (wip.tag) {
          // context 的出入栈需要维护
          case ContextProvider:
            const newValue = wip.memoizedProps.value;
            const conetxt = wip.type._context;
            pushProvider(conetxt, newValue);
            break;
          // TODO: Suspense
        }
        return bailoutOnAlreadyFinishedWork(wip, renderLane);
      }
    }
  }

  wip.lanes = NoLanes;

  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip, renderLane);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip, wip.type, renderLane);
    case Fragment:
      return updateFragment(wip);
    case ContextProvider:
      return updateContextProvider(wip, renderLane);
    case SuspenseComponent:
      return updateSuspenseComponent(wip);
    case OffscreenComponent:
      return updateOffscreenComponent(wip);
    case MemoComponent:
      return updateMemoComponent(wip, renderLane);
    default:
      if (__DEV__) {
        console.warn(`beginWork unimplemented tag: ${wip.tag}`);
      }
      break;
  }
  return null;
};

function updateMemoComponent(wip: FiberNode, renderLane: Lane) {
  const current = wip.alternate;
  const nextProps = wip.pendingProps;
  const Component = wip.type.type;

  if (current !== null) {
    const prevProps = current.memoizedProps;

    if (shallowEquals(prevProps, nextProps) && current.ref === wip.ref) {
      didReceiveUpdate = false;
      wip.pendingProps = prevProps;

      if (!checkScheduleUpdateOrContext(current, renderLane)) {
        wip.lanes = current.lanes;
        return bailoutOnAlreadyFinishedWork(wip, renderLane);
      }
    }
  }
  return updateFunctionComponent(wip, Component, renderLane);
}

function bailoutOnAlreadyFinishedWork(wip: FiberNode, renderLane: Lane) {
  if (!includeSomeLanes(wip.childLanes, renderLane)) {
    // 整个子树都不都命中了 bailout 策略
    if (__DEV__) {
      console.warn('bailout entire subtree: ', wip);
    }
    // beginWork 不需要往下走，所以这里放回 null 结束 beginWork
    return null;
  }

  if (__DEV__) {
    console.warn('bailout 一个单独的 fiber', wip);
  }
  cloneChildFibers(wip);
  return wip.child;
}

function checkScheduleUpdateOrContext(
  current: FiberNode,
  renderLane: Lane
): boolean {
  const updateLanes = current.lanes;

  if (includeSomeLanes(updateLanes, renderLane)) {
    return true;
  }

  return false;
}

function updateSuspenseComponent(wip: FiberNode) {
  const current = wip.alternate;
  const nextProps = wip.pendingProps;

  let showFallback = false;
  const didSuspense = (wip.flags & DidCapture) !== NoFlags;

  if (didSuspense) {
    showFallback = true;
    wip.flags &= ~DidCapture;
  }

  const nextPrimaryChildren = nextProps.children;
  const nextFallbackChildren = nextProps.fallback;
  pushSuspenseHandler(wip);

  if (current === null) {
    // mount
    if (showFallback) {
      return mountSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  } else {
    // udpate
    if (showFallback) {
      return updateSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  }
}

function mountSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  console.error('mountSuspenseFallbackChildren');
  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren
  };

  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
  const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

  // reconcile children 不会给 fallbackChildrenFragment 标记 Placement
  fallbackChildFragment.flags |= Placement;

  primaryChildFragment.return = wip;
  fallbackChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;

  return fallbackChildFragment;
}

function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren
  };

  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);

  wip.child = primaryChildFragment;
  primaryChildFragment.return = wip;
  return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment = currentPrimaryChildFragment.sibling;

  // 构建 primaryChildFragment
  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren
  };
  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );

  let fallbackChildFragment;

  if (currentFallbackChildFragment !== null) {
    // fallback fiberNode 可以复用
    fallbackChildFragment = createWorkInProgress(
      currentFallbackChildFragment,
      fallbackChildren
    );
  } else {
    // 没有可以复用的 fallback
    fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
    fallbackChildFragment.flags |= Placement;
  }

  fallbackChildFragment.return = wip;
  primaryChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;

  return fallbackChildFragment;
}

function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling;

  // 1.创建新的 primaryChildFragment fibernode
  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren
  };
  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );

  // 2.维护 suspense fiber 结构
  primaryChildFragment.return = wip;
  primaryChildFragment.sibling = null;
  wip.child = primaryChildFragment;

  // 3.删除旧的 fiber
  if (currentFallbackChildFragment !== null) {
    const deletions = wip.deletions;
    if (deletions === null) {
      wip.deletions = [currentFallbackChildFragment];
      wip.flags |= ChildDeletion;
    } else {
      deletions.push(currentFallbackChildFragment);
    }
  }

  return primaryChildFragment;
}

function updateOffscreenComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateContextProvider(wip: FiberNode, renderLane: Lane) {
  const providerType = wip.type as ReactProviderType<any>;
  const context = providerType._context;

  if (context === null) {
    throw new Error('Context is missing at Provider fiberNode');
  }

  const newProps = wip.pendingProps;
  const newChildren = newProps.children;
  const oldProps = wip.memoizedProps;
  const newValue = newProps.value;

  // 对 context 赋值操作
  pushProvider(context, newValue);

  if (oldProps !== null) {
    const oldValue = oldProps.value;
    if (
      Object.is(oldValue, newValue) &&
      oldProps.children === newProps.children
    ) {
      return bailoutOnAlreadyFinishedWork(wip, renderLane);
    } else {
      // context value 发生了变化
      // 向下寻找所有消费了当前 context 的 fiber，并且标记 fiber.lanes
      propagateContextChange(wip, context, renderLane);
    }
  }

  reconcileChildren(wip, newChildren);
  return wip.child;
}

// update state
// craete child fiberNode
function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  // clear pending update
  updateQueue.shared.pending = null;

  const prevChildren = wip.memoizedState;

  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);

  const current = wip.alternate;
  // RootDidNotComplete 的情况下，需要复用 memoizedState
  if (current !== null) {
    if (!current.memoizedState) {
      current.memoizedState = memoizedState;
    }
  }

  wip.memoizedState = memoizedState;

  const nextChildren = wip.memoizedState;

  if (prevChildren === nextChildren) {
    console.warn('host Root triggered bailout');
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }

  reconcileChildren(wip, nextChildren);
  return wip.child;
}

// craete child fiberNode
// no update trigger
function updateHostComponent(wip: FiberNode) {
  const nextPros = wip.pendingProps;
  const nextChildren = nextPros.children;
  markRef(wip.alternate, wip);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateFunctionComponent(
  wip: FiberNode,
  Component: FiberNode['type'],
  renderLane: Lane
) {
  prepareToReadContext(wip, renderLane);
  // 执行组件的 render
  const nextChildren = renderWithHooks(wip, Component, renderLane);

  const current = wip.alternate;

  if (current !== null && !didReceiveUpdate) {
    // 命中 bailout
    if (__DEV__) {
      console.warn('function component triggred bailout: ', wip);
    }
    bailoutHook(wip, renderLane);
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }

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

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
  const ref = workInProgress.ref;

  if (
    (current === null && ref !== null) ||
    (current !== null && current.ref !== ref)
  ) {
    workInProgress.flags |= Ref;
  }
}
