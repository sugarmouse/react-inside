import React, { useState, memo, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, update] = useState(0);
  console.log('App render ', num);
  // self-controled bailout
  const BailoutWithUseMemo = useMemo(() => <ExpensiveSubtree />, []);
  // cache the callback, do not create a new callback every render
  const onClick = useCallback(() => update(num + 100), []);

  return (
    <div onClick={() => update(num + 100)}>
      <p>num is: {num}</p>
      <MemoUseCallbackfunction onClick={onClick} />
      {BailoutWithUseMemo}
    </div>
  );
}

function UseCallBack({ onClick }) {
  console.log('UseCallBack render');
  return (
    <div onClick={onClick}>
      <p> this is useCallback test component</p>
    </div>
  );
}

const MemoUseCallbackfunction = memo(UseCallBack);

function ExpensiveSubtree() {
  console.log('ExpensiveSubtree render');
  return <p>i am child</p>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
