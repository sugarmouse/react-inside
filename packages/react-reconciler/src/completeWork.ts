import {
  Container,
  Instance,
  appendInitialChild,
  createInstance,
  createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent
} from './workTags';
import { NoFlags, Ref, Update, Visibility } from './fiberFlags';
import { popProvider } from './fiberContext';
import { ReactContextType, ReactProviderType } from 'shared/ReactTypes';
import { popSuspenseHandler } from './suspenseContext';
import { NoLane, NoLanes, mergeLanes } from './fiberLanes';

// dfs backward
/**
 * 构建离屏 DOM 树（没有真实的在 host 环境中挂在，挂载在 commit 阶段）
 */
export const completeWork = (wip: FiberNode) => {
  //
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // TODO: 检查每一项 props 是否变化， 比如 className ...
        // 有变化则打上 Update 标签，以下的 updateProps 放到 commit 阶段
        markUpdate(wip);

        // 标记 Ref
        if (current.ref !== wip.ref) {
          markRef(wip);
        }
      } else {
        // mount
        // 创建离屏 DOM，并插入父节点
        const instance = createInstance(wip.type, newProps);
        appendAllChildren(instance, wip);
        wip.stateNode = instance;

        // 标记 Ref
        if (wip.ref !== null) {
          markRef(wip);
        }
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // update
        // 文本节点的更新在 render 阶段只需要标记 Update 标签，后续处理在 commit 阶段进行
        const oldText = current.memoizedProps.content;
        const newText = newProps.content;

        if (oldText !== newText) {
          markUpdate(wip);
        }
      } else {
        // mount
        // 创建离屏 DOM，并插入父节点
        const instance = createTextInstance(newProps.content);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;

    case HostRoot:
    case FunctionComponent:
    case Fragment:
    case OffscreenComponent:
      // hostRoot 的对应的 host component 在
      // (hostRoot.stataeNode as FiberRootNode).container 上
      // 在 ReactDOM.createRoot().render() 阶段创建并且放在 fiberRootNode.container 上
      bubbleProperties(wip);
      return null;
    case ContextProvider:
      const providerType = wip.type as ReactProviderType<any>;
      const context = providerType._context as ReactContextType<any>;
      popProvider(context);
      bubbleProperties(wip);
      return null;
    case SuspenseComponent:
      // 在 Suspense fiber node 进行比较，是因为 归的过程可能不会经过 offscrren fiber
      popSuspenseHandler();
      const offscreenFiber = wip.child as FiberNode;
      const isHidden = offscreenFiber.pendingProps.mode === 'hidden';
      const currentOffscreenFiber = offscreenFiber.alternate;
      if (currentOffscreenFiber !== null) {
        // update
        const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden';

        if (wasHidden !== isHidden) {
          // visible -> hidden
          offscreenFiber.flags |= Visibility;
          bubbleProperties(offscreenFiber);
        }
      } else if (isHidden) {
        // mount hidden
        offscreenFiber.flags |= Visibility;
        bubbleProperties(offscreenFiber);
      }
      bubbleProperties(wip);
      return null;

    default:
      if (__DEV__) {
        console.warn(`completeWork unhandled fiber node: ${wip}`);
      }
      return null;
  }
};

function markUpdate(wip: FiberNode) {
  wip.flags |= Update;
}

function markRef(fiber: FiberNode) {
  fiber.flags |= Ref;
}

/**
 * 调用 host 环境的 api，append 所有子节点
 */
function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
  let node = wip.child;

  while (node !== null) {
    if (node?.tag === HostComponent || node?.tag === HostText) {
      appendInitialChild(parent, node?.stateNode);
    } else if (node.child !== null) {
      // 为了过滤非 host 的节点
      // 也就是 react 内部节点，不在 host 环境中需要真实挂载的节点
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      node = node?.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

/**
 * 收集直接子节点的 flags 和 subTreeFlags 到当前节点的 subTreeFlags 属性上
 *
 * @param {FiberNode} wip - The FiberNode to calculate bubble properties for.
 */
function bubbleProperties(wip: FiberNode) {
  let subTreeFlags = NoFlags;
  let child = wip.child;
  let newChildLanes = NoLanes;

  while (child !== null) {
    subTreeFlags |= child.subTreeFlags;
    subTreeFlags |= child.flags;

    newChildLanes = mergeLanes(
      newChildLanes,
      mergeLanes(child.lanes, child.childLanes)
    );

    child.return = wip;
    child = child.sibling;
  }

  wip.subTreeFlags = subTreeFlags;
  wip.childLanes = newChildLanes;
}
