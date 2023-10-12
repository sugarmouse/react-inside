import { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE } from 'shared/ReactSymbols';
import { ReactContextType } from 'shared/ReactTypes';

export function createContext<T>(defaultValue: T): ReactContextType<T> {
  const ctx: ReactContextType<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    Provider: null,
    _currentValue: defaultValue
  };

  ctx.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: ctx
  };

  return ctx;
}
