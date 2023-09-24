import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';
import { updateFiberProps, DOMElement } from './syntheticEvent';
import { Props } from 'shared/ReactTypes';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props) => {
  const element = document.createElement(type) as unknown;
  // TODO 处理 props
  updateFiberProps(element as DOMElement, props);
  return element as DOMElement;
};

export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

export const appendChildToContainer = (
  container: Container,
  child: Instance
) => {
  return container.appendChild(child);
};

export function insertChildToContainer(
  container: Container,
  child: Instance,
  before: Instance
) {
  return container.insertBefore(child, before);
}

export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content;
      return commitTextUpdate(fiber.stateNode, text);

    default:
      if (__DEV__) {
        console.warn('unimplemented update for node:', fiber);
      }
      return null;
  }
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.textContent = content;
}

export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  container.removeChild(child);
}

export const sheduleMicroTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
    ? (callback: (...args: any) => void) => Promise.resolve().then(callback)
    : setTimeout;
