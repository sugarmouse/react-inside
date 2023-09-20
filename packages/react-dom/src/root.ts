import { Container } from 'hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import {
  createContainer,
  updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { initEvent } from './syntheticEvent';

export function createRoot(container: Container) {
  const root = createContainer(container);

  return {
    render(element: ReactElementType) {
      initEvent(container, 'click');
      return updateContainer(element, root);
    }
  };
}
