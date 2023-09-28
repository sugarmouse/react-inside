import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer,
  removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
  ChildDeletion,
  Flags,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Update
} from './fiberFlags';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText
} from './workTags';
import { PendingPassiveEffects } from './fiber';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null = null;

// dfs 遍历 fiber node，每个节点执行 commitMutationEffectsOnFiber
export const commitMutationEffects = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;

    if (
      (nextEffect.subTreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
      child !== null
    ) {
      // 向下遍历到第一个 subTreeFlags 为 noFlags 的节点
      nextEffect = child;
    } else {
      // 在第一个 subTreeFlags 为 noFlags 的节点上执行 commitMutationEffectsOnFiber
      // 之后再往 sibling 节点走, 如果没有 sibling 往父节点走
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect, root);

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

function commitMutationEffectsOnFiber(
  finisdWork: FiberNode,
  root: FiberRootNode
) {
  const flags = finisdWork.flags;

  // check and commit placement
  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finisdWork);
    finisdWork.flags &= ~Placement; // 清除 Placement 标记
  }
  // check and commit update
  if ((flags & Update) !== NoFlags) {
    // 因为 commit update 涉及到对 host 环境的节点操作
    // 所以实现放在 renderer 的 hostConfig 里
    commitUpdate(finisdWork);
    finisdWork.flags &= ~Update;
  }
  // check and commit ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finisdWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childeToDelete) => {
        commitDeletion(childeToDelete, root);
      });
    }
    finisdWork.flags &= ~ChildDeletion;
    finisdWork.deletions = null;
  }

  if ((flags & PassiveEffect) !== NoFlags) {
    console.warn('fiber has passive effect', finisdWork);
    commitPassiveEffect(finisdWork, root, 'update');
    finisdWork.flags &= ~PassiveEffect;
  }
}

/**
 * 收集副作用到 root.pendingPassiveEffects
 */
function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffects
) {
  // 非函数组件 或者 函数组件没有副作用的情况下，直接 return
  if (
    fiber.tag !== FunctionComponent ||
    (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }

  // Effect环形链表 保存在 functionComponent fiber node 的 updateQueue.lastEffect 上
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.error('FC 存在 PassiveEffect flag, 但是没有收集到 Effect');
    }
    if (updateQueue.lastEffect === null) {
      console.error('FC 存在 PassiveEffect flag, 但是没有收集到 Effect');
      return;
    }
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect);
  }
}

// 执行副作用

function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;

  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
    effect.tag & ~HookHasEffect;
  });
}

export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
  });
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === 'function') {
      effect.destroy = create();
    }
  });
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDelete: FiberNode[] = [];

  // dfs 从需要 childToDelete 遍历 fiber tree，对每个节点执行回调函数
  // 因为当前需要删除的节点不一定是和 host 环境相关的节点
  // 所以需要向下遍历找到第一个和 host 环境相关的节点，进行节点的删除
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        // TODO: 解绑 ref
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        // TODO:  解绑 ref
        commitPassiveEffect(unmountFiber, root, 'unmount');
        return;
      default:
        if (__DEV__) {
          console.warn('unimplemented unmount for node:', unmountFiber);
        }
        return;
    }
  });

  // 当找到第一个 host 相关的子节点，直接从 host 环境删除此节点
  if (rootChildrenToDelete.length > 0) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) => {
        removeChild(node.stateNode, hostParent);
      });
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
  // get host parent
  const hostParent = getHostParent(finisdWork);

  // get host sibling
  const hostSibling = getHostSibling(finisdWork);

  // find finishedWork DOM and append to hostParent
  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(
      finisdWork,
      hostParent,
      hostSibling
    );
  }
}

function recordHostChildrenToDelete(
  childrenToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  const lastOne = childrenToDelete[childrenToDelete.length - 1];

  if (!lastOne) {
    // 1. 找到第一个 root host 节点
    childrenToDelete.push(unmountFiber);
  } else {
    // 2. 找到每一个 host 节点，判断这个节点是不是 1 找到的那个节点
    let node = lastOne.sibling;
    while (node !== null) {
      if (unmountFiber === node) {
        childrenToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
}

function getHostSibling(fiber: FiberNode) {
  let node = fiber;

  findSibling: while (true) {
    while (node.sibling === null) {
      const parent = node.return;

      // 父节点不存在或者父节点是 host 相关的节点
      // 说明当前节点没有 sibling 节点了
      if (
        parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        return null;
      }
      node = parent;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    // 找到的 node 不是 host 相关的节点
    while (node.tag !== HostText && node.tag !== HostComponent) {
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }

      if (node.child === null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
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

function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }

  // 传入 finishedWork 不是 host 相关的节点，递归往子节点找
  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
