import React, { useState, useContext, createContext, memo } from 'react';
import ReactDOM from 'react-dom/client';

const ctx = createContext(0);

export default function App() {
  const [num, update] = useState(0);
  console.log('App render ', num);
  return (
    <ctx.Provider value={num}>
      <div
        onClick={() => {
          update(1);
        }}
      >
        <Cpn />
      </div>
    </ctx.Provider>
  );
}

const Cpn = memo(function () {
  console.log('Cpn render');
  return (
    <div>
      <Child />
    </div>
  );
});

function Child() {
  console.log('Child render');
  const val = useContext(ctx);

  return <div>ctx: {val}</div>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
