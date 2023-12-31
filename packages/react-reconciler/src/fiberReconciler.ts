import { Container } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { HostRoot } from './workTags';
import { ReactElementType } from 'shared/ReactTypes';
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate
} from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { requestUpdateLane } from './fiberLanes';
import {
  unstable_ImmediatePriority,
  unstable_runWithPriority
} from 'scheduler';

// create an instance of FiberRootNode,
// which is the root node of all fiberNodes
export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.updateQueue = createUpdateQueue();
  return root;
}

/**
 * Updates the container with the given element and returns the updated element.
 */
export function updateContainer(
  element: ReactElementType | null,
  root: FiberRootNode
) {
  // 首屏渲染修改为同步的更新
  unstable_runWithPriority(unstable_ImmediatePriority, () => {
    const hostRootFiber = root.current;
    const lane = requestUpdateLane();
    const udpate = createUpdate<ReactElementType | null>(element, lane);
    enqueueUpdate(
      hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
      udpate,
      hostRootFiber,
      lane
    );
    // 连接更新流程与调度机制
    scheduleUpdateOnFiber(hostRootFiber, lane);
  });

  return element;
}
