let syncQueue: ((...args: any) => void)[] | null = null;
let isFlushingSyncQueue = false;

export function scheduleSyncCallback(callback: (...args: any) => void) {
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

export function flushSyncCallbackQueue() {
  if (!isFlushingSyncQueue && syncQueue) {
    isFlushingSyncQueue = true;
    try {
      syncQueue.forEach((callback) => {
        callback();
      });
    } catch (e) {
      if (__DEV__) {
        console.warn('flushSyncCallbackQueue error', e);
      }
    } finally {
      isFlushingSyncQueue = false;
    }
  }
}
