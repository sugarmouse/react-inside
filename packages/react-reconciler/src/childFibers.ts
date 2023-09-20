import { Props, ReactElementType } from 'shared/ReactTypes';
import {
  FiberNode,
  createFiberFromElement,
  createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

function ChildReconciler(shouldTrackEffects: boolean) {
  // ...
  function markDeleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffects) {
      return;
    }

    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ): FiberNode {
    const key = element.key;
    // 如果 key 相同，type 相同，则可以复用 fiber 节点
    update: if (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // key 相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // type 相同, key 相同, 复用 FiberNode
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            return existing;
          }

          // key相同，type 不同, 删除旧的
          markDeleteChild(returnFiber, currentFiber);
          break update;
        } else {
          if (__DEV__) {
            console.warn(`unhandled fiber type: ${element}`);
            break update;
          }
        }
      } else {
        // key 不同, 删掉旧的
        markDeleteChild(returnFiber, currentFiber);
      }
    }

    // 根据 ReactElement 创建 FiberNode
    // 并且 return 指向父节点
    const fiber = createFiberFromElement(element);
    fiber.return = returnFiber;
    return fiber;
  }

  // 根据 ReactElement HostText 创建 FiberNode
  // 并且 return 指向父节点
  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ): FiberNode {
    if (currentFiber !== null) {
      // update
      if (currentFiber.tag === HostText) {
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        return existing;
      }
      // 当前节点存在但是不是 hostTest 类型
      markDeleteChild(returnFiber, currentFiber);
    }

    // mount
    // create a new HostText fiber node
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  /**
   * 根据需要，给当前 fiber 打上 Placement tag
   * @returns 当前 fiber
   */
  function placeSingleChild(fiber: FiberNode) {
    // 首屏渲染或者需要标记副作用的时候才给 flags 标记 Placement
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber;
  }

  return function reconcileChildFibers(
    wipReturnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: ReactElementType
  ) {
    // handle sigle react element
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(wipReturnFiber, currentFiber, newChild)
          );
        default:
          if (__DEV__) {
            console.warn(`unhandled fiber type: ${String(newChild.$$typeof)}`);
          }
          break;
      }
    }

    // TODO handle multiple react element

    // handle plain text node
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(wipReturnFiber, currentFiber, newChild)
      );
    }

    // 兜底
    // 比如 newChild 为 null 或者 undefined
    if (currentFiber !== null) {
      markDeleteChild(wipReturnFiber, currentFiber);
    }

    if (__DEV__) {
      console.warn(`unhandled fiber type: ${String(newChild)}`);
    }

    return null;
  };
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
