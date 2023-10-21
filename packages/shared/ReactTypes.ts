export type Type = any;
export type Key = any;
export type Ref = { current: any } | ((instance: any) => void);
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
  $$typeof: symbol | number;
  key: Key;
  type: Type;
  props: Props;
  ref: Ref | null;
  __mark: string;
}

// a param , which is a fucntion or an new state, can be assigned to action,
// like const [a, updateA] = useState(0);
// updateA(a => a + 1) or updateA(1)
export type Action<State> = State | ((prevState: State) => State);

export type ReactContextType<T> = {
  $$typeof: symbol | number;
  Provider: ReactProviderType<T> | null;
  _currentValue: T;
};

export type ReactProviderType<T> = {
  $$typeof: symbol | number;
  _context: ReactContextType<T> | null;
};

// TODO: add thenable
export type Usable<T> = Thenable<T> | ReactContextType<T>;

export type Thenable<T, Result = void, Err = any> =
  | UntrackedThenable<T, Result, Err>
  | PendingThenable<T, Result, Err>
  | FulfilledThenable<T, Result, Err>
  | RejectedThenable<T, Result, Err>;

interface ThenableImpl<T, Result, Err> {
  then(
    onFulfill: (value: T) => Result,
    onReject: (error: Err) => Result
  ): void | Wakeable<Result>;
}

export interface Wakeable<Result = any> {
  then(
    onFulfill: () => Result,
    onReject: () => Result
  ): void | Wakeable<Result>;
}

export interface UntrackedThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status?: void;
}

export interface FulfilledThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'fulfilled';
  value: T;
}

export interface RejectedThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'rejected';
  reason: Err;
}

export interface PendingThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'pending';
}
