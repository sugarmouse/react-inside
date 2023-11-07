import { ReactContextType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import {
  Lane,
  Lanes,
  NoLanes,
  includeSomeLanes,
  isSubsetOfLanes,
  mergeLanes
} from './fiberLanes';
import { markWipReceivedUpdate } from './beginWork';
import { ContextProvider } from './workTags';

export interface ContextItem<Value> {
  context: ReactContextType<Value>;
  memorizedState: Value;
  next: ContextItem<Value> | null;
}

let lastContextDep: ContextItem<any> | null;

let prevContextValue: any = null;
const prevContextValueStack: any[] = [];

export function pushProvider<T>(context: ReactContextType<T>, newValue: T) {
  prevContextValueStack.push(prevContextValue);
  prevContextValue = context._currentValue;
  context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContextType<T>) {
  context._currentValue = prevContextValue;
  prevContextValue = prevContextValueStack.pop();
}

export function prepareToReadContext(wip: FiberNode, renderLane: Lane) {
  lastContextDep = null;

  const deps = wip.dependencies;
  if (deps !== null) {
    const firstContext = deps.firstContext;
    if (firstContext !== null) {
      if (includeSomeLanes(deps.lanes, renderLane)) {
        markWipReceivedUpdate();
      }
      deps.firstContext = null;
    }
  }
}

export function readContext<T>(
  context: ReactContextType<T>,
  consumer: FiberNode | null
): T {
  const value = context._currentValue;
  if (consumer === null) {
    throw new Error('useContext can only invoked in a function component');
  }
  // 维护 fiber.dependencies 单向链表结构
  const contextItem: ContextItem<T> = {
    context,
    next: null,
    memorizedState: value
  };

  if (lastContextDep === null) {
    // 当前 fiber 依赖的第一个 context
    lastContextDep = contextItem;
    consumer.dependencies = {
      firstContext: lastContextDep,
      lanes: NoLanes
    };
  } else {
    // 当前传入的 context 不是当前 fiber 所依赖的第一个 context
    lastContextDep.next = contextItem;
    lastContextDep = lastContextDep.next;
  }
  return value;
}

export function propagateContextChange<T>(
  wip: FiberNode,
  context: ReactContextType<T>,
  renderLane: Lanes
) {
  let fiber = wip.child;
  if (fiber !== null) {
    fiber.return = wip;
  }

  while (fiber !== null) {
    let nextFiber: FiberNode | null = null;
    const deps = fiber.dependencies;
    if (deps !== null) {
      // 遍历到的 fiber 消费了 context
      nextFiber = fiber.child;

      let contextItem = deps.firstContext;
      while (contextItem !== null) {
        if (contextItem.context === context) {
          // 找到了依赖当前 context 的 component，fiber
          fiber.lanes = mergeLanes(fiber.lanes, renderLane);
          const current = fiber.alternate;
          if (current !== null) {
            current.lanes = mergeLanes(current.lanes, renderLane);
          }
          // TODO 往上走
          scheduleContextWorkOnParentPath(fiber.return, wip, renderLane);
          deps.lanes = mergeLanes(deps.lanes, renderLane);
          break;
        }
        contextItem = contextItem.next;
      }
    } else if (fiber.tag === ContextProvider) {
      // 如果 fiber 和 传入的 wip 是同一个 context.provider 则直接退出，
      // 因为 beginWork 遍历到 这个 context fiber 的时候会自己开启一遍同样的遍历流程
      nextFiber = fiber.type === wip.type ? null : fiber.child;
    } else {
      nextFiber = fiber.child;
    }

    if (nextFiber !== null) {
      nextFiber.return = fiber;
    } else {
      nextFiber = fiber;
      while (nextFiber !== null) {
        if (nextFiber === wip) {
          nextFiber = null;
          break;
        }
        const sibling = nextFiber.sibling;
        if (sibling !== null) {
          sibling.return = nextFiber.return;
          nextFiber = sibling;
          break;
        }
        nextFiber = nextFiber.return;
      }
    }
    fiber = nextFiber;
  }
}

function scheduleContextWorkOnParentPath(
  from: FiberNode | null,
  to: FiberNode,
  renderLane: Lane
) {
  let fiber = from;

  while (fiber !== null) {
    const current = fiber.alternate;

    if (!isSubsetOfLanes(fiber.childLanes, renderLane)) {
      fiber.childLanes = mergeLanes(fiber.childLanes, renderLane);
      if (current !== null)
        current.childLanes = mergeLanes(current.childLanes, renderLane);
    } else if (
      current !== null &&
      !isSubsetOfLanes(current.childLanes, renderLane)
    ) {
      current.childLanes = mergeLanes(current.childLanes, renderLane);
    }

    if (fiber === to) break;
    fiber = fiber.return;
  }
}
