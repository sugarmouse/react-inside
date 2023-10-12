import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [isDel, del] = useState(false);
  const divRef = useRef(null);

  console.warn('render divRef', divRef.current);

  useEffect(() => {
    console.warn('useEffect divRef', divRef.current);
  }, []);

  return (
    <div ref={divRef} onClick={() => del(true)}>
      {isDel ? null : <Child />}
    </div>
  );
}

function Child() {
  function handleClick(dom) {
    console.warn('dom is:', dom);
  }
  return <p ref={handleClick}>Child</p>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
