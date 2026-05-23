import AsyncStorage from '@react-native-async-storage/async-storage';

const POLL_STATE_PREFIX = '@opencode_poll_state_';

/**
 * Snapshot of server state captured during each background poll.
 * Used to diff against the next poll and detect changes worth notifying about.
 */
export interface PollState {
  /** Session IDs that were busy or retry at the time of this poll */
  busySessionIds: string[];
  /** Pending question request IDs at the time of this poll */
  pendingQuestionIds: string[];
  /** Pending permission request IDs at the time of this poll */
  pendingPermissionIds: string[];
  /** Unix timestamp (ms) of when this poll ran */
  timestamp: number;
}

export async function savePollState(serverId: string, state: PollState): Promise<void> {
  await AsyncStorage.setItem(
    `${POLL_STATE_PREFIX}${serverId}`,
    JSON.stringify(state),
  );
}

export async function loadPollState(serverId: string): Promise<PollState | null> {
  const raw = await AsyncStorage.getItem(`${POLL_STATE_PREFIX}${serverId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PollState;
  } catch {
    return null;
  }
}

export async function clearPollState(serverId: string): Promise<void> {
  await AsyncStorage.removeItem(`${POLL_STATE_PREFIX}${serverId}`);
}
