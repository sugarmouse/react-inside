import { Container } from 'hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import {
  createContainer,
  updateContainer
} from 'react-reconciler/src/fiberReconciler';

export function creatRoot(container: Container) {
  const root = createContainer(container);

  return {
    render(element: ReactElementType) {
      updateContainer(element, root);
    }
  };
}
