import {
  FulfilledThenable,
  PendingThenable,
  RejectedThenable,
  Thenable
} from 'shared/ReactTypes';

// code from reactjs repo
// An error that is thrown (e.g. by `use`) to trigger Suspense. If we
// detect this is caught by userspace, we'll log a warning in development.
export const SuspenseException = new Error(
  "Suspense Exception: This is not a real error! It's an implementation " +
    'detail of `use` to interrupt the current render. You must either ' +
    'rethrow it immediately, or move the `use` call outside of the ' +
    '`try/catch` block. Capturing without rethrowing will lead to ' +
    'unexpected behavior.\n\n' +
    'To handle async errors, wrap your component in an error boundary, or ' +
    "call the promise's `.catch` method and pass the result to `use`"
);

function noop() {}

let suspendedThenable: Thenable<any> | null = null;
export function getSuspenseThenable() {
  if (suspendedThenable === null) {
    throw new Error('Expected a suspended thenable. This is a bug in React');
  }
  const thenable = suspendedThenable;
  suspendedThenable = null;
  return thenable;
}

export function trackUsedThenabel<T>(thenable: Thenable<T>) {
  switch (thenable.status) {
    case 'fulfilled':
      return thenable.value;
    case 'rejected':
      throw thenable.reason;

    default:
      if (typeof thenable.status === 'string') {
        // pending
        thenable.then(noop, noop);
      } else {
        // untracked -> pending
        const pending = thenable as unknown as PendingThenable<T, any, any>;
        pending.status = 'pending';
        pending.then(
          (val) => {
            if (pending.status === 'pending') {
              // pending -> fulfilled
              // @ts-ignore
              const fulfilled: FulfilledThenable<T, void, any> = pending;
              fulfilled.status = 'fulfilled';
              fulfilled.value = val;
            }
          },
          (err) => {
            if (pending.status === 'pending') {
              // pending -> rejected
              // @ts-ignore
              const rejected: RejectedThenable<T, void, any> = pending;
              rejected.reason = err;
              rejected.status = 'rejected';
            }
          }
        );
      }
  }
  suspendedThenable = thenable;
  throw SuspenseException;
}
