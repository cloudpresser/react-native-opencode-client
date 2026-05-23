/**
 * Background poll task (Layer 3).
 *
 * This file MUST be imported at the top level of App.tsx so that
 * TaskManager.defineTask() runs before React renders.
 *
 * When the app is backgrounded, the OS periodically wakes us up
 * (minimum ~15 min on both platforms) to poll each configured server
 * for status changes and pending questions/permissions.
 */
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OpenCodeService } from '../services/opencode';
import { notificationService } from '../services/notifications';
import { loadPollState, savePollState, PollState } from '../services/notificationState';
import { Server, Session } from '../types';

const SERVERS_KEY = '@opencode_servers';
const SESSIONS_KEY = '@opencode_sessions';

export const BACKGROUND_POLL_TASK = 'OPENCODE_BACKGROUND_POLL';

TaskManager.defineTask(BACKGROUND_POLL_TASK, async () => {
  try {
    // Load all configured servers from AsyncStorage
    const serversRaw = await AsyncStorage.getItem(SERVERS_KEY);
    if (!serversRaw) return BackgroundTask.BackgroundTaskResult.Success;

    const servers: Server[] = JSON.parse(serversRaw);

    for (const server of servers) {
      try {
        const service = new OpenCodeService(server);

        // Quick health check — skip unreachable servers
        const healthy = await service.healthCheck();
        if (!healthy) continue;

        // Load sessions for this server (for title lookup)
        const sessionsRaw = await AsyncStorage.getItem(`${SESSIONS_KEY}_${server.id}`);
        const sessions: Session[] = sessionsRaw ? JSON.parse(sessionsRaw) : [];
        const sessionTitleMap = new Map(sessions.map((s) => [s.id, s.title]));

        // Fetch current state from server
        const [statuses, questions, permissions] = await Promise.all([
          service.getSessionStatuses(),
          service.listPendingQuestions(),
          service.listPendingPermissions(),
        ]);

        const currentBusyIds = Object.keys(statuses);
        const currentQuestionIds = questions.map((q) => q.id);
        const currentPermissionIds = permissions.map((p) => p.id);

        // Load previous poll state for diffing
        const prevState = await loadPollState(server.id);

        if (prevState) {
          const previousQuestionIds = prevState.pendingQuestionIds || [];
          const previousPermissionIds = prevState.pendingPermissionIds || [];

          // Detect sessions that were busy but are now idle → agent finished
          for (const prevBusyId of prevState.busySessionIds) {
            if (!currentBusyIds.includes(prevBusyId)) {
              const title = sessionTitleMap.get(prevBusyId) || 'Session';
              await notificationService.notifyAgentFinished(prevBusyId, server.id, title);
            }
          }

          // Detect new pending questions
          for (const q of questions) {
            if (!previousQuestionIds.includes(q.id)) {
              const title = sessionTitleMap.get(q.sessionID) || 'Session';
              const header = q.questions?.[0]?.header || '';
              await notificationService.notifyQuestionAsked(q.sessionID, server.id, title, header);
            }
          }

          for (const permission of permissions) {
            if (!previousPermissionIds.includes(permission.id)) {
              const title = sessionTitleMap.get(permission.sessionID) || 'Session';
              await notificationService.notifyPermissionAsked(
                permission.sessionID,
                server.id,
                title,
                permission.permission.type,
              );
            }
          }

          // Detect sessions that became busy (weren't before) → agent woke up
          for (const busyId of currentBusyIds) {
            if (!prevState.busySessionIds.includes(busyId)) {
              const title = sessionTitleMap.get(busyId) || 'Session';
              await notificationService.notifyAgentActive(busyId, server.id, title);
            }
          }
        }

        // Save current state for next poll
        const newState: PollState = {
          busySessionIds: currentBusyIds,
          pendingQuestionIds: currentQuestionIds,
          pendingPermissionIds: currentPermissionIds,
          timestamp: Date.now(),
        };
        await savePollState(server.id, newState);
      } catch (err) {
        // Skip this server on error, continue to next
        console.error(`Background poll error for server ${server.name}:`, err);
      }
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    console.error('Background poll task error:', err);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register the background poll task with the OS.
 * Call once at app startup (e.g. in App.tsx useEffect).
 */
export async function registerBackgroundPoll(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_POLL_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_POLL_TASK, {
        minimumInterval: 15 * 60, // 15 minutes in seconds
      });
    }
  } catch (err) {
    console.error('Failed to register background poll task:', err);
  }
}
