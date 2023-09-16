import React from 'react';
import ReactDOM from 'react-dom/client';

function Child() {
  return <div>child</div>;
}

function App() {
  return (
    <div>
      <Child />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
