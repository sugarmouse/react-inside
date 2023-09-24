import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);

  return (
    <ul
      onClick={() => {
        setNum((num) => num + 1);
      }}
    >
      {num}
    </ul>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
