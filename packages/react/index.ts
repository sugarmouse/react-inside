import currentDispatcher, {
  Dispatcher,
  resolveDispatcher
} from './src/currentDispatcher';
import { jsx, isValidElement as isValidElementFn } from './src/jsx';

// const [a, setA] = useState(0);
export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};
export const useEffect: Dispatcher['useEffect'] = (callback, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(callback, deps);
};

// 内部数据共享层
// 放在 shared 包中中转使用
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher
  // ReactCurrentCache,
  // ReactCurrentBatchConfig,
  // ReactCurrentOwner,
};

export const isValidElement = isValidElementFn;
export const version = '0.0.1';
// TODO 根据环境暴露不同的 jsx
export const createElement = jsx;
