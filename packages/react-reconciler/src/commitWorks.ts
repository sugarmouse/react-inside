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
      // 向下遍历到第一个没有 subTreeFlags 为 noFlags 的节点
      (nextEffect.subTreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
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
  appedPlacementNodeIntoContainer(finisdWork, hostParent);
}

function getHostParent(fiber: FiberNode): Container {
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
}

function appedPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  container: Container
) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(finishedWork.stateNode, container);
    return;
  }

  const child = finishedWork.child;
  if (child !== null) {
    appedPlacementNodeIntoContainer(child, container);

    const sibling = child.sibling;
    if (sibling !== null) {
      appedPlacementNodeIntoContainer(sibling, container);
    }
  }
}
