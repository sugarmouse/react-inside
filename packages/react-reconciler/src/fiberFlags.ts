export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

export const PassiveEffect = 0b0001000;
export const Ref = 0b0010000;
export const Visibility = 0b0100000;

//
export const DidCapture = 0b1000000;

// unwind
export const ShouldCapture = 0b10000000;

export const MutationMask =
  Placement | Update | ChildDeletion | Ref | Visibility;
export const LayoutMask = Ref;

// 组件卸载的时候需要执行 useEffect 的 destroy 函数
export const PassiveMask = PassiveEffect | ChildDeletion;
