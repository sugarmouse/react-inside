import { FiberNode } from './fiber';

const suspenseHandlerStack: FiberNode[] = [];

export function pushSuspenseHandler(hander: FiberNode) {
  suspenseHandlerStack.push(hander);
}
