import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DevGallery } from './dev/DevGallery';
import { ReshufflePreview } from './dev/ReshufflePreview';
import './styles/tokens.css';
import './styles/app.css';
import './styles/playful.css';

const path = window.location.pathname.replace(/\/$/, '');
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{path === '/dev/reshuffle' ? <ReshufflePreview/> : path === '/dev' ? <DevGallery/> : <App/>}</React.StrictMode>);
