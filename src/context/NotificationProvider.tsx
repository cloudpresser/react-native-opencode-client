/**
 * NotificationProvider — the brain of the notification system.
 *
 * Layer 1 (Foreground): Opens a global SSE connection to GET /event for the
 * selected server. Monitors all sessions for status changes, new messages,
 * and pending questions. Fires local notifications when appropriate.
 *
 * Layer 2 (Resume): Listens for AppState changes. When the app returns
 * from background, reconnects the SSE and polls the server to catch up
 * on anything that happened while JS was suspended.
 */
import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import EventSource from 'react-native-sse';
import base64 from 'base-64';
import { useStore } from '../store';
import { OpenCodeService, PermissionAskedEvent, QuestionAskedEvent } from '../services/opencode';
import { notificationService } from '../services/notifications';
import { savePollState, PollState } from '../services/notificationState';
import { Server } from '../types';

/** 5-minute gap threshold for "agent woke up" detection */
const WAKE_GAP_MS = 5 * 60 * 1000;

/** Reconnect delay after SSE error (with exponential backoff) */
const BASE_RECONNECT_MS = 2000;
const MAX_RECONNECT_MS = 30000;

interface NotificationContextValue {
  /** Currently pending questions across all sessions (from SSE) */
  pendingQuestions: QuestionAskedEvent[];
  /** Currently pending permissions across all sessions (from SSE) */
  pendingPermissions: PermissionAskedEvent[];
}

const NotificationContext = createContext<NotificationContextValue>({
  pendingQuestions: [],
  pendingPermissions: [],
});

export function useNotificationContext() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { servers, sessions, viewedSessionId } = useStore();
  const [pendingQuestions, setPendingQuestions] = useState<QuestionAskedEvent[]>([]);
  const [pendingPermissions, setPendingPermissions] = useState<PermissionAskedEvent[]>([]);

  // Track which server we're currently connected to
  const connectedServerRef = useRef<Server | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track per-session state for notification logic
  const lastMessageTimeRef = useRef<Map<string, number>>(new Map());
  const knownBusySessionsRef = useRef<Set<string>>(new Set());
  const knownQuestionIdsRef = useRef<Set<string>>(new Set());
  const knownPermissionIdsRef = useRef<Set<string>>(new Set());

  // AppState tracking
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Session title lookup
  const getSessionTitle = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      return session?.title || 'Session';
    },
    [sessions],
  );

  /**
   * Should we fire a notification for this session?
   * Suppressed if the user is currently viewing it.
   */
  const shouldNotify = useCallback(
    (sessionId: string) => {
      return viewedSessionId !== sessionId;
    },
    [viewedSessionId],
  );

  // ─── Layer 1: Global SSE ──────────────────────────────────────

  const connectSSE = useCallback(
    (server: Server) => {
      // Clean up any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const baseUrl = `http${server.useSSL ? 's' : ''}://${server.host}:${server.port}`;
      const headers: Record<string, string> = {};

      if (server.apiKey) {
        headers.Authorization = `Basic ${base64.encode(`opencode:${server.apiKey}`)}`;
      }

      const es = new EventSource(`${baseUrl}/event`, { headers });
      eventSourceRef.current = es;
      connectedServerRef.current = server;

      es.addEventListener('message', (event: any) => {
        try {
          const raw = typeof event === 'string' ? event : event?.data;
          if (!raw) return;
          const data = JSON.parse(raw);
          handleSSEEvent(data, server);
        } catch {
          // Ignore malformed events
        }
      });

      es.addEventListener('error', () => {
        // Connection lost — schedule reconnect with backoff
        if (eventSourceRef.current === es) {
          eventSourceRef.current = null;
          scheduleReconnect(server);
        }
      });

      // Reset reconnect counter on successful connection
      reconnectAttemptRef.current = 0;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const scheduleReconnect = useCallback(
    (server: Server) => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      const delay = Math.min(
        BASE_RECONNECT_MS * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_MS,
      );
      reconnectAttemptRef.current++;

      reconnectTimerRef.current = setTimeout(() => {
        // Only reconnect if app is active and this is still the target server
        if (
          appStateRef.current === 'active' &&
          connectedServerRef.current?.id === server.id
        ) {
          connectSSE(server);
        }
      }, delay);
    },
    [connectSSE],
  );

  const handleSSEEvent = useCallback(
    (data: any, server: Server) => {
      if (!data?.type) return;

      const props = data.properties;

      // ── session.status ──
      if (data.type === 'session.status' && props?.sessionID) {
        const sessionId = props.sessionID;
        const statusType = props?.status?.type;
        const wasBusy = knownBusySessionsRef.current.has(sessionId);

        if (statusType === 'idle') {
          knownBusySessionsRef.current.delete(sessionId);
          if (wasBusy && shouldNotify(sessionId)) {
            const title = getSessionTitle(sessionId);
            notificationService.notifyAgentFinished(sessionId, server.id, title);
          }
        } else if (statusType === 'busy' || statusType === 'retry') {
          if (!wasBusy && shouldNotify(sessionId)) {
            // Session just became busy — agent woke up
            // But only notify if there was a gap > 5min since last activity
            const lastTime = lastMessageTimeRef.current.get(sessionId) || 0;
            const now = Date.now();
            if (lastTime > 0 && now - lastTime > WAKE_GAP_MS) {
              const title = getSessionTitle(sessionId);
              notificationService.notifyAgentActive(sessionId, server.id, title);
            }
          }
          knownBusySessionsRef.current.add(sessionId);
        }
        return;
      }

      // ── message.part.updated ──
      if (data.type === 'message.part.updated' && props?.part?.sessionID) {
        const sessionId = props.part.sessionID;
        lastMessageTimeRef.current.set(sessionId, Date.now());
        return;
      }

      // ── question.asked ──
      if (data.type === 'question.asked' && props?.id) {
        const questionId = props.id;
        if (!knownQuestionIdsRef.current.has(questionId)) {
          knownQuestionIdsRef.current.add(questionId);

          const sessionId = props.sessionID;
          const header = props.questions?.[0]?.header || '';

          // Track for context consumers
          const event: QuestionAskedEvent = {
            id: props.id,
            sessionID: sessionId,
            questions: props.questions || [],
            tool: props.tool,
          };
          setPendingQuestions((prev) => [...prev.filter((item) => item.id !== event.id), event]);

          if (shouldNotify(sessionId)) {
            const title = getSessionTitle(sessionId);
            notificationService.notifyQuestionAsked(sessionId, server.id, title, header);
          }
        }
        return;
      }

      // ── permission.asked ──
      if (data.type === 'permission.asked' && props?.id) {
        const permissionId = props.id;
        if (!knownPermissionIdsRef.current.has(permissionId)) {
          knownPermissionIdsRef.current.add(permissionId);

          const sessionId = props.sessionID;
          const event: PermissionAskedEvent = {
            id: props.id,
            sessionID: sessionId,
            permission: {
              type: props.permission,
              patterns: props.patterns,
              metadata: props.metadata,
              always: props.always,
            },
            tool: props.tool,
          };
          setPendingPermissions((prev) => [...prev.filter((item) => item.id !== event.id), event]);

          if (shouldNotify(sessionId)) {
            const title = getSessionTitle(sessionId);
            notificationService.notifyPermissionAsked(
              sessionId,
              server.id,
              title,
              props.permission,
            );
          }
        }
        return;
      }
    },
    [shouldNotify, getSessionTitle],
  );

  // ─── Layer 2: AppState Recovery ───────────────────────────────

  const pollServerOnResume = useCallback(
    async (server: Server) => {
      try {
        const service = new OpenCodeService(server);

        const [statuses, questions, permissions] = await Promise.all([
          service.getSessionStatuses(),
          service.listPendingQuestions(),
          service.listPendingPermissions(),
        ]);

        const currentBusyIds = new Set(Object.keys(statuses));

        // Detect sessions that finished while we were backgrounded
        for (const prevBusyId of knownBusySessionsRef.current) {
          if (!currentBusyIds.has(prevBusyId) && shouldNotify(prevBusyId)) {
            const title = getSessionTitle(prevBusyId);
            notificationService.notifyAgentFinished(prevBusyId, server.id, title);
          }
        }

        // Detect new questions
        for (const q of questions) {
          if (!knownQuestionIdsRef.current.has(q.id)) {
            knownQuestionIdsRef.current.add(q.id);

            const sessionId = q.sessionID;
            const header = q.questions?.[0]?.header || '';

            setPendingQuestions((prev) => [...prev.filter((item) => item.id !== q.id), {
              id: q.id,
              sessionID: sessionId,
              questions: q.questions || [],
              tool: q.tool,
            }]);

            if (shouldNotify(sessionId)) {
              const title = getSessionTitle(sessionId);
              notificationService.notifyQuestionAsked(sessionId, server.id, title, header);
            }
          }
        }

        for (const permission of permissions) {
          if (!knownPermissionIdsRef.current.has(permission.id)) {
            knownPermissionIdsRef.current.add(permission.id);

            const sessionId = permission.sessionID;
            setPendingPermissions((prev) => [...prev.filter((item) => item.id !== permission.id), permission]);

            if (shouldNotify(sessionId)) {
              const title = getSessionTitle(sessionId);
              notificationService.notifyPermissionAsked(
                sessionId,
                server.id,
                title,
                permission.permission.type,
              );
            }
          }
        }

        // Detect newly busy sessions (agent woke up while backgrounded)
        for (const busyId of currentBusyIds) {
          if (!knownBusySessionsRef.current.has(busyId) && shouldNotify(busyId)) {
            const title = getSessionTitle(busyId);
            notificationService.notifyAgentActive(busyId, server.id, title);
          }
        }

        // Update tracking state
        knownBusySessionsRef.current = currentBusyIds;

        // Also save poll state for Layer 3 consistency
        const pollState: PollState = {
          busySessionIds: Array.from(currentBusyIds),
          pendingQuestionIds: questions.map((q) => q.id),
          pendingPermissionIds: permissions.map((permission) => permission.id),
          timestamp: Date.now(),
        };
        await savePollState(server.id, pollState);

        knownQuestionIdsRef.current = new Set(questions.map((q) => q.id));
        knownPermissionIdsRef.current = new Set(permissions.map((permission) => permission.id));
        setPendingQuestions(questions);
        setPendingPermissions(permissions);
      } catch (err) {
        console.error('Error polling server on resume:', err);
      }
    },
    [shouldNotify, getSessionTitle],
  );

  // ─── Effects ──────────────────────────────────────────────────

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize();
    notificationService.requestPermissions();
  }, []);

  // Connect/disconnect SSE when server changes
  // We connect to the first server that's available. In a multi-server setup,
  // we'd need one SSE per server — for now, use the first configured server.
  useEffect(() => {
    const server = servers[0]; // Primary server
    if (!server) {
      // No servers configured — disconnect
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      connectedServerRef.current = null;
      return;
    }

    // If already connected to this server, skip
    if (connectedServerRef.current?.id === server.id && eventSourceRef.current) {
      return;
    }

    connectSSE(server);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [servers, connectSSE]);

  // AppState listener for Layer 2
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';

      if (wasBackground && nextState === 'active') {
        // App resumed from background
        const server = connectedServerRef.current;
        if (server) {
          // Reconnect SSE (it died when backgrounded)
          connectSSE(server);
          // Poll to catch up
          pollServerOnResume(server);
        }
      }

      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [connectSSE, pollServerOnResume]);

  const contextValue: NotificationContextValue = {
    pendingQuestions,
    pendingPermissions,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}
