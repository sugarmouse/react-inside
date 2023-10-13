import { ReactContextType } from 'shared/ReactTypes';

let prevContextValue: any = null;
const prevContextValueStack: any[] = [];

export function pushProvider<T>(context: ReactContextType<T>, newValue: T) {
  prevContextValueStack.push(prevContextValue);
  prevContextValue = context._currentValue;
  context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContextType<T>) {
  context._currentValue = prevContextValue;
  prevContextValue = prevContextValueStack.pop();
}
