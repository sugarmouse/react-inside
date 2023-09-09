import { Props, Key, Ref } from 'shared/ReactTypes';
import { WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';

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
  /**
   * current：与视图中真实UI对应的fiberNode树
   * workInProgress：触发更新后，正在reconciler中计算的fiberNode树
   * alternate 是两者的切换的缓存
   * */
  alternate: FiberNode | null;
  flags: Flags;
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

    this.alternate = null;
    // side effect
    this.flags = NoFlags;
  }
}
