import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
  const [num, update] = useState(0);
  console.log('App render ', num);
  return (
    <div
      onClick={() => {
        update(1);
      }}
    >
      <Cpn />
    </div>
  );
}

function Cpn() {
  console.log('cpn render');
  return <div>cpn</div>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
