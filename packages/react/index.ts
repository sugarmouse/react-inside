import currentBatchConfig from './src/currentBatchConfig';
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher
} from './src/currentDispatcher';
import { jsx, isValidElement as isValidElementFn } from './src/jsx';
export {
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_SUSPENSE_TYPE as Suspense
} from 'shared/ReactSymbols';

export { createContext } from './src/context';
export { memo } from './src/memo';

// const [a, setA] = useState(0);
export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};
export const useEffect: Dispatcher['useEffect'] = (callback, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(callback, deps);
};
export const useTransition: Dispatcher['useTransition'] = () => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
};
export const useRef: Dispatcher['useRef'] = (initValue) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initValue);
};
export const useContext: Dispatcher['useContext'] = (context) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useContext(context);
};
export const useCallback: Dispatcher['useCallback'] = (callback, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useCallback(callback, deps);
};
export const useMemo: Dispatcher['useMemo'] = (nextCreate, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useMemo(nextCreate, deps);
};
export const use: Dispatcher['use'] = (useable) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.use(useable);
};

// 内部数据共享层
// 放在 shared 包中中转使用
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
  currentBatchConfig
  // ReactCurrentCache,
  // ReactCurrentOwner,
};

export const isValidElement = isValidElementFn;
export const version = '0.0.1';
// TODO 根据环境暴露不同的 jsx
export const createElement = jsx;
