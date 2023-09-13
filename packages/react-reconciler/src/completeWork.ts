import {
  appendInitialChild,
  createInstance,
  createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import { HostComponent, HostRoot, HostText } from './workTags';

// dfs backward
export const completeWork = (wip: FiberNode) => {
  //
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // update
      } else {
        // mount
        // 创建离屏 DOM，并插入父节点
        const instance = createInstance(wip.type, newProps);
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
      }
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // update
      } else {
        // mount
        // 创建离屏 DOM，并插入父节点
        const instance = createTextInstance(newProps.content);
        wip.stateNode = instance;
      }
      return null;

    case HostRoot:
      return null;

    default:
      if (__DEV__) {
        console.warn(`completeWork unhandled fiber node: ${wip}`);
      }
      return null;
  }
};

function appendAllChildren(parent: FiberNode, wip: FiberNode) {
  let node = wip.child;

  while (node !== null) {
    if (node?.tag === HostComponent || node?.tag === HostText) {
      appendInitialChild(parent, node?.stateNode);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
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
    node.sibling.return = node;
    node = node.sibling;
  }
}
