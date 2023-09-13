export type Container = Element;
export type Instance = Element;

export const createInstance = (type: string, props: any) => {
  const element = document.createElement(type);
  // TODO 处理 props
  return element;
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
