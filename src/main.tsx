import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FinanceProvider } from './store';
import App from './App';
import './global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><FinanceProvider><App /></FinanceProvider></BrowserRouter></React.StrictMode>,
);
