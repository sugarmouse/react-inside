// for FiberNode.tag
export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment
  | typeof ContextProvider;

export const FunctionComponent = 'FunctionComponent';
export const HostRoot = 'HostRoot';
export const HostComponent = 'HostComponent';
export const HostText = 'HostText';
export const Fragment = 'Fragment';
export const ContextProvider = 'ContextProvider';
