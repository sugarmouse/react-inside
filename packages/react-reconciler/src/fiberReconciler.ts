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
import { requestUpdateLanes } from './fiberLanes';

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
  const hostRootFiber = root.current;
  const lane = requestUpdateLanes();
  const udpate = createUpdate<ReactElementType | null>(element, lane);
  enqueueUpdate(
    hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
    udpate
  );
  // 连接更新流程与调度机制
  scheduleUpdateOnFiber(hostRootFiber, lane);
  return element;
}
