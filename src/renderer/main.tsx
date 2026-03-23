import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles/global.css';
import './styles/editor.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />,
);
