import React, { useState, memo } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, update] = useState(0);
  console.log('App render ', num);
  return (
    <div onClick={() => update(num + 1)}>
      <MemoCpn num={num} name={'cpn1'} />
      <MemoCpn num={0} name={'cpn2'} />
    </div>
  );
}

function Cpn({ num, name }) {
  console.log('render ', name);
  return (
    <div>
      {name}: {num}
      <Child />
    </div>
  );
}

const MemoCpn = memo(Cpn);

function Child() {
  console.log('Child render');
  return <p>i am child</p>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
