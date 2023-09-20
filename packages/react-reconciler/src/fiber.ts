import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import { FunctionComponent, HostComponent, WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
  type: any; //
  tag: WorkTag;
  key: Key;
  pendingProps: Props;
  stateNode: any;

  return: FiberNode | null; /*父节点*/
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number; /*节点自身在 sibling 中的索引*/

  ref: Ref;
  memoizedProps: Props | null; /*当前 fiber 工作结束时的 props 缓存*/
  memoizedState: any;
  /**
   * current：与视图中真实UI对应的fiberNode树
   * workInProgress：触发更新后，正在reconciler中计算的fiberNode树
   * alternate 是两者的切换的缓存
   * */
  alternate: FiberNode | null;
  flags: Flags;
  subTreeFlags: Flags;
  updateQueue: unknown;
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag;
    this.key = key;
    // HostComponent <div> 保存 div DOM
    this.stateNode = null;
    // FunctionComponent ()=> {} 本身
    this.type = null;

    // for relationship among fiber nodes
    this.return = null;
    this.sibling = null;
    this.child = null;
    this.index = 0;

    this.ref = null;

    // for working unit
    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.memoizedState = null;
    this.updateQueue = null;

    this.alternate = null;
    // side effect
    this.flags = NoFlags;
    this.subTreeFlags = NoFlags;
    this.deletions = null;
  }
}

//
export class FiberRootNode {
  container: Container; // point to react app container wihich is  host-unrelated root
  current: FiberNode;
  finishedWork: FiberNode | null; // point to the update-completed hostRootFiber

  constructor(contianer: Container, hostRootFiber: FiberNode) {
    this.container = contianer;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
  }
}

export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;

  if (wip === null) {
    // mount
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    // update
    wip.pendingProps = pendingProps;
    wip.flags = NoFlags;
    wip.subTreeFlags = NoFlags;
    wip.deletions = null;
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;

  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;

  return wip;
};

export function createFiberFromElement(element: ReactElementType) {
  const { type, props, key } = element;

  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === 'string') {
    fiberTag = HostComponent;
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn(`unhandled fiber type: ${type}`);
  }

  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  return fiber;
}
