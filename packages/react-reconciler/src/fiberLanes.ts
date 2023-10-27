import { FiberRootNode } from './fiber';
// import currentBatchConfig from 'react/src/currentBatchConfig';
import internals from 'shared/internals';
import {
  unstable_getCurrentPriorityLevel as getCurrentPriorityLevel,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
  unstable_IdlePriority
} from 'scheduler';

export type Lane = number;
export type Lanes = number;

export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;
export const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000000010;
export const DefaultLane: Lane = /*                     */ 0b0000000000000000000000000000100;
export const TransitionLane: Lane = /*                  */ 0b0000000000000000000000000001000;
export const IdleLane: Lane = /*                        */ 0b0000000000000000000000000010000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLane(): Lane {
  const { currentBatchConfig } = internals;
  // useTranstion 放如宏任务执行
  const isTransition = currentBatchConfig.transition !== null;
  if (isTransition) {
    return TransitionLane;
  }

  // 从全局获取调度优先级
  const currentSchedulerPriority = getCurrentPriorityLevel();
  const lane = schedulerPriorityToLane(currentSchedulerPriority);
  return lane;
}

function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;

  root.suspendedLanes = NoLanes;
  root.pingdLanes = NoLanes;
}

export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes);

  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }
  return unstable_IdlePriority;
}

export function schedulerPriorityToLane(schedulerPriority: number): Lane {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return NoLane;
}

export function isSubsetOfLanes(set: Lanes, subSet: Lane): boolean {
  return (set & subSet) === subSet;
}

export function markRootSuspended(root: FiberRootNode, suspendedLane: Lane) {
  root.suspendedLanes |= suspendedLane;
  root.pendingLanes &= ~suspendedLane;
}

export function markRootPingd(root: FiberRootNode, pingedLane: Lane) {
  root.pingdLanes |= root.suspendedLanes & pingedLane;
}

export function getNextLane(root: FiberRootNode): Lane {
  const pendingLanes = root.pendingLanes;

  if (pendingLanes === NoLane) {
    return NoLane;
  }

  let nextLane = NoLane;

  const unsuspendedLanes = pendingLanes & ~root.suspendedLanes;

  if (unsuspendedLanes !== NoLanes) {
    // 没有挂起的更新 lane
    nextLane = getHighestPriorityLane(unsuspendedLanes);
  } else {
    // 挂起的更新中有没有 pinged lane
    const pingedLanes = pendingLanes & root.pingdLanes;
    if (pingedLanes !== NoLanes) {
      nextLane = getHighestPriorityLane(pingedLanes);
    }
  }

  return nextLane;
}
