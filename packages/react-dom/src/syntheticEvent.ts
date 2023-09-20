import { Container } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';
const validEventTypeList = ['click'];

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}

type EventCallback = (e: Event) => void;

interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}

interface SyntheticEvent extends Event {
  __stopPropagation: boolean;
}

// 将 reactElement 的 props 保存到 DOMElement
export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props;
}

export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn(`Invalid event type: ${eventType}, at DOM`, container);
    return;
  }

  if (__DEV__) {
    console.log('init event', eventType);
  }

  container.addEventListener(eventType, (event: Event) => {
    dispatchEvent(container, eventType, event);
  });
}

function dispatchEvent(container: Container, eventType: string, event: Event) {
  const targetElement = event.target;

  if (targetElement === null) {
    console.warn('event target is not exist', event);
  }
  // 收集事件
  const { bubble, capture } = collectPaths(
    targetElement as DOMElement,
    container,
    eventType
  );
  // 构造合成事件
  const se = createSyntheticEvent(event);
  // 遍历 capture
  triggerEventFlow(capture, se);
  // 遍历 bubble
  if (!se.__stopPropagation) {
    triggerEventFlow(bubble, se);
  }
}

function collectPaths(
  targetElement: DOMElement,
  container: Container,
  eventType: string
) {
  const allEvents: Paths = {
    bubble: [],
    capture: []
  };

  while (targetElement && targetElement !== container) {
    const elementProps = targetElement[elementPropsKey];

    if (elementProps) {
      const callbackNameList = getEventCallbackNameFromEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (i == 0) {
              // capture
              // 为了保持 trigger 的时候正序遍历执行
              // DOM 节点从下往上走，遍历执行的时候需要从上往下，符合冒泡的顺序
              // 所以事件函数需要 unshift
              allEvents.capture.unshift(eventCallback);
            } else {
              // bubble
              allEvents.bubble.push(eventCallback);
            }
          }
        });
      }
    }
    targetElement = targetElement.parentNode as DOMElement;
  }
  return allEvents;
}

function getEventCallbackNameFromEventType(
  eventType: string
): string[] | undefined {
  return {
    click: ['onClickCapture', 'onClick']
  }[eventType];
}

function createSyntheticEvent(event: Event) {
  const syntheticEvent = event as SyntheticEvent;
  syntheticEvent.__stopPropagation = false;
  const originStopPropagation = event.stopPropagation;

  // 构造新的 propagation 方法
  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  };

  return syntheticEvent;
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    callback.call(null, se);

    if (se.__stopPropagation) {
      break;
    }
  }
}
