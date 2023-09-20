import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

console.log('somsfewr');

function App() {
  const [num, setNum] = useState(0);
  window.setNum = setNum;
  return num === 0 ? <Child /> : <div>{num}</div>;
}

function Child() {
  return <div>num is 0</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
