import { Container, Instance } from './hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import {
  createContainer,
  updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import * as Scheduler from 'scheduler';

let idCounter = 0;

export function createRoot() {
  const container: Container = {
    rootID: idCounter++,
    children: []
  };

  function getChildren(parent: Instance | Container) {
    if (parent) {
      return parent.children;
    }
  }

  function getChildrenAsJSX(root: Container) {
    const children = childToJSX(getChildren(root));

    if (Array.isArray(children)) {
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type: REACT_FRAGMENT_TYPE,
        key: null,
        ref: null,
        props: { children },
        __mark: 'self_made'
      };
    }

    return children;
  }

  function childToJSX(child: any): any {
    if (typeof child === 'string' || typeof child === 'number') {
      return child;
    }

    // child is an array of Instance or TextInstance
    if (Array.isArray(child)) {
      if (child.length === 0) {
        return null;
      }

      if (child.length === 1) {
        return childToJSX(child[0]);
      }

      const children = child.map(childToJSX);

      if (
        child.every(
          (child) => typeof child === 'string' || typeof child === 'number'
        )
      ) {
        return children.join('');
      }

      return children;
    }

    // child is a Instance
    if (Array.isArray(child.children)) {
      const instance: Instance = child;
      const children = childToJSX(instance.children);
      const props = instance.props;

      if (children !== null) {
        props.children = children;
      }

      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type: instance.type,
        key: null,
        ref: null,
        props,
        __mark: 'self_made'
      };
    }

    // child is a TextInstance
    return child.text;
  }
  // @ts-ignore
  const root = createContainer(container);
  return {
    _Scheduler: Scheduler,
    render(element: ReactElementType) {
      return updateContainer(element, root);
    },
    getChildren() {
      return getChildren(container);
    },
    getChildrenAsJSX() {
      return getChildrenAsJSX(container);
    }
  };
}
