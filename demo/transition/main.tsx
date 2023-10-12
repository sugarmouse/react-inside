import ReactDOM from 'react-dom/client';
import React from 'react';

import { useState, useTransition } from 'react';
import TabButton from './TabButton';
import AboutTab from './AboutTab';
import PostsTab from './PostsTab';
import ContactTab from './ContactTab';
import './style.css';

function App() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('about');
  console.log('hello');
  function selectTab(nextTab) {
    startTransition(() => {
      console.log(`click at tab ${nextTab}`);
      setTab(nextTab);
    });
  }

  return (
    <>
      <TabButton isActive={tab === 'about'} onClick={() => selectTab('about')}>
        About
      </TabButton>
      <TabButton isActive={tab === 'posts'} onClick={() => selectTab('posts')}>
        Posts (slow)
      </TabButton>
      <TabButton
        isActive={tab === 'contact'}
        onClick={() => selectTab('contact')}
      >
        Contact
      </TabButton>
      <hr />
      {tab === 'about' && <AboutTab />}
      {tab === 'posts' && <PostsTab />}
      {tab === 'contact' && <ContactTab />}
    </>
  );
}

// eslint
const root = ReactDOM.createRoot(document.querySelector('#root')!);

root.render(<App />);
