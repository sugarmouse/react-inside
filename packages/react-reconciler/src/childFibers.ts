import { Props, ReactElementType } from 'shared/ReactTypes';
import {
  FiberNode,
  createFiberFromElement,
  createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

function ChildReconciler(shouldTrackEffects: boolean) {
  // ...
  function markDeleteChild(
    wipReturnFiber: FiberNode,
    childToDelete: FiberNode
  ) {
    if (!shouldTrackEffects) {
      return;
    }

    const deletions = wipReturnFiber.deletions;
    if (deletions === null) {
      wipReturnFiber.deletions = [childToDelete];
      wipReturnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function markDeleteRemainingChildren(
    wipReturnFiber: FiberNode,
    currentFisrtChild: FiberNode | null
  ) {
    if (!shouldTrackEffects) {
      return;
    }
    let childToDelete = currentFisrtChild;
    while (childToDelete !== null) {
      markDeleteChild(wipReturnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
  }

  // 处理更新之后只有单个 fiber 节点的情况
  // ABC -> A, A -> B, A -> A
  function reconcileSingleElement(
    wipReturnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ): FiberNode {
    const key = element.key;
    // 如果 key 相同，type 相同，则可以复用 fiber 节点
    while (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // key 相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // type 相同, key 相同, 复用 FiberNode
            const existing = useFiber(currentFiber, element.props);
            existing.return = wipReturnFiber;
            // 之前旧的 FiberNode 存在多余一个的
            markDeleteRemainingChildren(wipReturnFiber, currentFiber.sibling);
            return existing;
          }

          // key相同，type 不同, 删除旧的
          markDeleteRemainingChildren(wipReturnFiber, currentFiber);
          break;
        } else {
          if (__DEV__) {
            console.warn(`unhandled fiber type: ${element}`);
            break;
          }
        }
      } else {
        // key 不同, 删掉旧的
        markDeleteChild(wipReturnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }

    // currentFiber 不存在
    // mount
    const fiber = createFiberFromElement(element);
    fiber.return = wipReturnFiber;
    return fiber;
  }

  // 根据 ReactElement HostText 创建 FiberNode
  // 并且 return 指向父节点
  function reconcileSingleTextNode(
    wipReturnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ): FiberNode {
    while (currentFiber !== null) {
      // update
      if (currentFiber.tag === HostText) {
        const existing = useFiber(currentFiber, { content });
        existing.return = wipReturnFiber;
        markDeleteRemainingChildren(wipReturnFiber, currentFiber.sibling);
        return existing;
      }
      // 当前节点存在但是不是 hostTest 类型
      markDeleteChild(wipReturnFiber, currentFiber);
      currentFiber = currentFiber.sibling;
    }

    // mount
    // create a new HostText fiber node
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = wipReturnFiber;
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

  function reconcileChildrenArray(
    wipReturnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChildren: any[]
  ) {
    let lastPlacedIndex = 0;
    let lastNewFiber: FiberNode | null = null;
    let firstNewFiber: FiberNode | null = null;

    // 将 current children fiber 节点保存在 map 中
    const existingChildren: ExistingChildren = new Map();
    let p = currentFirstChild;
    while (p !== null) {
      const keyToUse = p.key !== null ? p.key : p.index;
      existingChildren.set(keyToUse, p);
      p = p.sibling;
    }

    for (let index = 0; index < newChildren.length; index++) {
      // 遍历 newChildren，查找是否有可复用的节点
      const after = newChildren[index];
      const newFiber = updateFromMap(
        wipReturnFiber,
        existingChildren,
        index,
        after
      );

      if (newFiber === null) continue;

      // 维护 sibling node 的单链表结构
      // 并且记录链表的 头
      newFiber.index = index;
      newFiber.return = wipReturnFiber;
      if (lastNewFiber === null) {
        // 更新后的第一个节点
        lastNewFiber = newFiber;
        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }

      // 标记移动还是插入
      if (!shouldTrackEffects) continue;

      const current = newFiber.alternate;
      if (current !== null) {
        // update
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          // 标记移动
          newFiber.flags |= Placement;
          continue;
        } else {
          // 不需要移动
          lastPlacedIndex = oldIndex;
        }
      } else {
        // mount
        newFiber.flags |= Placement;
      }
    }

    // map 中剩下的标记删除
    existingChildren.forEach((fiber) => {
      markDeleteChild(wipReturnFiber, fiber);
    });

    return firstNewFiber;
  }

  function updateFromMap(
    wipReturnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index;
    // 和 element key 相同的 fiberNode
    const before = existingChildren.get(keyToUse);

    // HostText
    if (typeof element === 'string' || typeof element === 'number') {
      if (before) {
        if (before.tag === HostText) {
          existingChildren.delete(keyToUse);
          return useFiber(before, { content: element + '' });
        }
      }
      return new FiberNode(HostText, { content: element + '' }, null);
    }

    // ReactElement
    if (typeof element === 'object' && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (before) {
            if (before.type === element.type) {
              existingChildren.delete(keyToUse);
              return useFiber(before, element.props);
            }
          }
          return createFiberFromElement(element);
        default:
          if (__DEV__) {
            console.warn(`unhandled fiber type: ${String(element.$$typeof)}`);
          }
      }
    }

    // TODO: handle multiple react element
    if (Array.isArray(element) && __DEV__) {
      console.warn('unhandled multiple react element');
      return null;
    }

    // 比如 更新之后的 element 为 null
    return null;
  }

  /**
   * wipReturnFiber: FiberNode wip 的 fiberTree 中的正在渲染的 fiber
   * currentFiber: wipReturnFiber.alternate.child
   * newChild?: 需要在 wipReturnFiber.child 中插入的新的 ReactElementType
   */
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

      // handle multiple react element
      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(wipReturnFiber, currentFiber, newChild);
      }
    }

    // handle plain text node
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(wipReturnFiber, currentFiber, newChild)
      );
    }

    // 兜底
    // 比如 newChild 为 null 或者 undefined
    if (currentFiber !== null) {
      markDeleteRemainingChildren(wipReturnFiber, currentFiber);
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
