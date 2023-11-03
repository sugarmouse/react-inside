import { Props, Key, Ref, ReactElementType, Wakeable } from 'shared/ReactTypes';
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  MemoComponent,
  OffscreenComponent,
  SuspenseComponent,
  WorkTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';
import {
  REACT_MEMO_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_SUSPENSE_TYPE
} from 'shared/ReactSymbols';

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

  ref: Ref | null;
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

  // 记录当前节点以及子树拥有的更新，为了性能优化
  lanes: Lanes;
  childLanes: Lanes;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag;
    this.key = key || null;
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

    this.lanes = NoLanes;
    this.childLanes = NoLanes;
  }
}

export interface PendingPassiveEffects {
  unmount: Effect[];
  update: Effect[];
}

//
export class FiberRootNode {
  container: Container; // point to react app container wihich is  host-unrelated root
  current: FiberNode;
  finishedWork: FiberNode | null; // point to the update-completed hostRootFiber

  pendingLanes: Lanes;

  finishedLane: Lane;
  pendingPassiveEffects: PendingPassiveEffects; // collect effect after update

  // 为了区分 render 阶段bu
  suspendedLanes: Lanes;
  pingdLanes: Lanes;

  callbackNode: CallbackNode | null;
  callbackPriority: Lane;

  // for caching ping
  pingCache: WeakMap<Wakeable<any>, Set<Lane>> | null;

  constructor(contianer: Container, hostRootFiber: FiberNode) {
    this.container = contianer;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;

    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;
    this.suspendedLanes = NoLane;
    this.pingdLanes = NoLane;

    this.callbackNode = null;
    this.callbackPriority = NoLane;

    this.pendingPassiveEffects = {
      unmount: [],
      update: []
    };

    this.pingCache = null;
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

  wip.ref = current.ref;

  wip.lanes = current.lanes;
  wip.childLanes = current.childLanes;

  return wip;
};

export function createFiberFromElement(element: ReactElementType) {
  const { type, props, key, ref } = element;

  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === 'string') {
    fiberTag = HostComponent;
  } else if (typeof type === 'object') {
    switch (type.$$typeof) {
      case REACT_PROVIDER_TYPE:
        fiberTag = ContextProvider;
        break;
      case REACT_MEMO_TYPE:
        fiberTag = MemoComponent;
        break;
      default:
        if (__DEV__) {
          console.error('undefined type', element);
        }
    }
  } else if (type === REACT_SUSPENSE_TYPE) {
    fiberTag = SuspenseComponent;
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn(`unhandled fiber type: ${type}`);
  }

  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  fiber.ref = ref;
  return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}

export interface OffscreenProps {
  mode: 'visible' | 'hidden';
  children: any;
}

export function createFiberFromOffscreen(pendingProps: OffscreenProps) {
  const fiber = new FiberNode(OffscreenComponent, pendingProps, null);

  // TODO: stateNode
  return fiber;
}
