import reactConfig from './react.config';
import reactDOMConfig from './react-dom.config';
import reactNoopRendererConfig from './react-noop-renderer.config';

export default () => {
  return [...reactDOMConfig, ...reactConfig, ...reactNoopRendererConfig];
};
