import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

console.log('somsfewr');

function App() {
  const [num, setNum] = useState(0);
  return <div onClickCapture={() => setNum(num + 1)}>{num}</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
