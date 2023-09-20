import {
  Container,
  appendChildToContainer,
  commitUpdate,
  removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
  ChildDeletion,
  MutationMask,
  NoFlags,
  Placement,
  Update
} from './fiberFlags';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText
} from './workTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;

    if (
      (nextEffect.subTreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
      // 向下遍历到第一个 subTreeFlags 为 noFlags 的节点
      nextEffect = child;
    } else {
      // 在第一个 subTreeFlags 为 noFlags 的节点上执行 commitMutationEffectsOnFiber
      // 之后再往 sibling 节点走, 如果没有 sibling 往父节点走
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect);

        const sibling: FiberNode | null = nextEffect.sibling;
        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        nextEffect = nextEffect.return;
      }
    }
  }
};

function commitMutationEffectsOnFiber(finisdWork: FiberNode) {
  const flags = finisdWork.flags;

  // check and commit placement
  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finisdWork);
    finisdWork.flags &= ~Placement; // 清除 Placement 标记
  }
  // TODO: check and commit update
  if ((flags & Update) !== NoFlags) {
    // 因为 commit update 涉及到对 host 环境的节点操作
    // 所以实现放在 renderer 的 hostConfig 里
    commitUpdate(finisdWork);
    finisdWork.flags &= ~Update;
  }
  // TODO: check and commit ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finisdWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childeToDelete) => {
        commitDeletion(childeToDelete);
      });
    }
    finisdWork.flags &= ~ChildDeletion;
    finisdWork.deletions = null;
  }
}

function commitDeletion(childToDelete: FiberNode) {
  let rootHostNode: FiberNode | null = null;

  // dfs 从需要 childToDelete 遍历 fiber tree，对每个节点执行回调函数
  // 因为当前需要删除的节点不一定是和 host 环境相关的节点
  // 所以需要向下遍历找到第一个和 host 环境相关的节点，进行节点的删除
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        if (rootHostNode === null) {
          rootHostNode = unmountFiber;
        }
        // TODO: 解绑 ref
        return;
      case HostText:
        if (rootHostNode === null) {
          rootHostNode = unmountFiber;
        }
        return;
      case FunctionComponent:
        // TODO: useEffect unmount, 解绑 ref
        return;
      default:
        if (__DEV__) {
          console.warn('unimplemented unmount for node:', unmountFiber);
        }
        return;
    }
  });

  // 当找到第一个 host 相关的子节点，直接从 host 环境删除此节点
  if (rootHostNode !== null) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      removeChild((rootHostNode as FiberNode).stateNode, hostParent);
    }
  }
  // 清除 fiber
  childToDelete.return = null;
  childToDelete.child = null;
}

// 从 root 开始 dfs 遍历，并对节点执行回调
function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);

    // 向下
    if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === root) {
      return;
    }

    // 一直向上（没有向右的路径的时候）
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      node = node.return;
    }

    // 向右走一步
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function commitPlacement(finisdWork: FiberNode) {
  if (__DEV__) {
    console.warn('commit placement for node:', finisdWork);
  }

  // get host parent
  const hostParent = getHostParent(finisdWork);
  // find finishedWork DOM and append to hostParent
  if (hostParent !== null) {
    appendPlacementNodeIntoContainer(finisdWork, hostParent);
  }
}

/**
 * 找到当前 fiber 对应的 stateNode 在 host 环境中的 父节点
 */
function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;

  while (parent) {
    const parentTag = parent.tag;
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container as Container;
    }
    parent = parent.return;
  }
  if (__DEV__) {
    console.warn('get host parent node failed');
  }
  return null;
}

function appendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  container: Container
) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(container, finishedWork.stateNode);
    return;
  }

  const child = finishedWork.child;
  if (child !== null) {
    appendPlacementNodeIntoContainer(child, container);

    const sibling = child.sibling;
    if (sibling !== null) {
      appendPlacementNodeIntoContainer(sibling, container);
    }
  }
}
