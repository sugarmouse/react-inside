import { HookDeps } from 'react-reconciler/src/fiberHooks';
import { Action, ReactContextType, Usable } from 'shared/ReactTypes';

export interface Dispatcher {
  useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
  useEffect: (callback: () => void | void, deps: any[] | void) => void;
  useTransition: () => void;
  useRef: <T>(initValue: T) => { current: T };
  useContext: <T>(context: ReactContextType<T>) => T;
  useMemo: <T>(nextCreate: () => T, deps?: HookDeps) => T;
  useCallback: <T extends CallableFunction>(callback: T, deps?: HookDeps) => T;
  use: <T>(useable: Usable<T>) => T;
}

export type Dispatch<State> = (action: Action<State>) => void;

const currentDispatcher: { current: Dispatcher | null } = {
  current: null
};

/**
 * 函数 `resolveDispatcher` 用于获取当前的 `Dispatcher`
 */
export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;

  if (dispatcher === null) {
    throw new Error('hooks can only be called in a React function component');
  }
  return dispatcher;
};

export default currentDispatcher;
