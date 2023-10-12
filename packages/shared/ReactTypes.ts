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
  ref: Ref;
  __mark: string;
}

// a param , which is a fucntion or an new state, can be assigned to action,
// like const [a, updateA] = useState(0);
// updateA(a => a + 1) or updateA(1)
export type Action<State> = State | ((prevState: State) => State);
