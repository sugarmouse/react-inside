import { Wakeable } from 'shared/ReactTypes';
import { FiberRootNode } from './fiber';
import { Lane } from './fiberLanes';
import { getSuspenseHandler } from './suspenseContext';
import { ShouldCapture } from './fiberFlags';
import { ensureRootIsScheduled, markRootUpdated } from './workLoop';

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function'
  ) {
    // this is a thenanle
    const wakeable: Wakeable<any> = value;

    const suspenseBoundary = getSuspenseHandler();
    if (suspenseBoundary) {
      suspenseBoundary.flags |= ShouldCapture;
    }
    attachPingListener(root, wakeable, lane);
  }
}

function attachPingListener(
  root: FiberRootNode,
  wakeable: Wakeable<any>,
  lane: Lane
) {
  let pingCache = root.pingCache;
  let threadIDs: Set<Lane> | undefined;

  if (pingCache === null) {
    threadIDs = new Set();
    pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
    pingCache.set(wakeable, threadIDs);
  } else {
    threadIDs = pingCache.get(wakeable);
    if (threadIDs === undefined) {
      threadIDs = new Set();
      pingCache.set(wakeable, threadIDs);
    }
  }

  if (!threadIDs.has(lane)) {
    // 第一次进入
    threadIDs.add(lane);

    function ping() {
      if (pingCache !== null) {
        pingCache.delete(wakeable);
      }
      // 触发更新
      markRootUpdated(root, lane);
      ensureRootIsScheduled(root);
    }
    // wakeable resolve 之后触发更新
    wakeable.then(ping, ping);
  }
}
