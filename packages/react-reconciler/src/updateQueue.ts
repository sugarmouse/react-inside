import { Action } from 'shared/ReactTypes';
import { Update } from './fiberFlags';

export interface Update<State> {
  action: Action<State>;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
}

// create an instance of 'update'
export const createUpdate = <State>(action: Action<State>) => {
  return {
    action
  };
};

// create an instance of 'updateQueue'
export const createUpdateQueue = <Action>() => {
  return {
    shared: {
      pending: null
    }
  } as UpdateQueue<Action>;
};

//  Enqueues an update to the update queue.
export const enqueueUpdate = <Action>(
  updateQueue: UpdateQueue<Action>,
  update: Update<Action>
) => {
  updateQueue.shared.pending = update;
};

// Process the update queue and return the memoized state.
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State>
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  };
  if (pendingUpdate !== null) {
    const action = pendingUpdate.action;
    if (action instanceof Function) {
      result.memoizedState = action(baseState);
    } else {
      result.memoizedState = action;
    }
  }

  return result;
};
