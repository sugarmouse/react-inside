type ReactElementLikeType = symbol | number;

const supportSymbol = typeof Symbol === 'function' && Symbol.for;

export let REACT_ELEMENT_TYPE: ReactElementLikeType = 0xeac7;
export let REACT_FRAGMENT_TYPE: ReactElementLikeType = 0xeacb;

if (supportSymbol) {
  REACT_ELEMENT_TYPE = Symbol.for('react.element');
  REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
}
