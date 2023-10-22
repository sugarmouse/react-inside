import { FiberNode } from './fiber';

const suspenseHandlerStack: FiberNode[] = [];

export function pushSuspenseHandler(hander: FiberNode) {
  suspenseHandlerStack.push(hander);
}

export function getSuspenseHandler() {
  return suspenseHandlerStack[suspenseHandlerStack.length - 1];
}

export function popSuspenseHandler() {
  suspenseHandlerStack.pop();
}
