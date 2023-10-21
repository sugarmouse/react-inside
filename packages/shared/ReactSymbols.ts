type ReactElementLikeType = symbol | number;

const supportSymbol = typeof Symbol === 'function' && Symbol.for;

export let REACT_ELEMENT_TYPE: ReactElementLikeType = 0xeac7;
export let REACT_FRAGMENT_TYPE: ReactElementLikeType = 0xeacb;
export let REACT_PROVIDER_TYPE: ReactElementLikeType = 0xeacd;
export let REACT_CONTEXT_TYPE: ReactElementLikeType = 0xeace;
export let REACT_SUSPENSE_TYPE: ReactElementLikeType = 0xead1;
export let REACT_SUSPENSE_LIST_TYPE: ReactElementLikeType = 0xead8;

if (supportSymbol) {
  REACT_ELEMENT_TYPE = Symbol.for('react.element');
  REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
  REACT_PROVIDER_TYPE = Symbol.for('react.provider');
  REACT_CONTEXT_TYPE = Symbol.for('react.context');
  REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
  REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
}
