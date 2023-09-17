import currentDispatcher, {
  Dispatcher,
  resolveDispatcher
} from './src/currentDispatcher';
import { jsxDEV } from './src/jsx';

export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

// 内部数据共享层
// 放在 shared 包中中转使用
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher
  // ReactCurrentCache,
  // ReactCurrentBatchConfig,
  // ReactCurrentOwner,
};

export default {
  version: '0.0.1',
  ReactElement: jsxDEV
};
