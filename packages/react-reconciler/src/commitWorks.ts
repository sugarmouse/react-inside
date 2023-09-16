import { Container, appendChildToContainer } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';

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
  // TODO: check and commit ChildDeletion
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