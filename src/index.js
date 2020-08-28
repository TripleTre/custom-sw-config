import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';


ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(process.env.NODE_ENV === 'development' ? './sw.js' : './sw.out.js')
    .then(registration => {
      console.log(`Service worker registered with scope: ${registration.scope}`);
    })
}
