import { FiberNode } from './fiber';

// dfs forward
export const beginWork: (fiber: FiberNode) => FiberNode | null = (
  fiber: FiberNode
) => {
  // compare ReactElement with fiber node
  // and return child fiber node
  const child = fiber.child;
  return child;
};
