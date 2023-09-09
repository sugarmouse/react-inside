const supportSymbol = typeof Symbol === 'function' && Symbol.for;

export const REACR_ELEMENT_TYPE = supportSymbol
  ? Symbol.for('react.element')
  : 0xacfe;
