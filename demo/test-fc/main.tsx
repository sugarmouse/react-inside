import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function Child() {
  const [num, setNum] = useState(0);
  return <div>{num}</div>;
}

function App() {
  return (
    <div>
      <Child />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
