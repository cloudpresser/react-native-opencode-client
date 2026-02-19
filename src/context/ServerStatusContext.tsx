import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Server, ConnectionStatus, ConnectionLogEntry, ConnectionLogCallback } from '../types';
import { checkServerHealth } from '../services/serverStatus';
import { useStore } from '../store';

interface ServerStatusContextValue {
  statuses: Record<string, ConnectionStatus>;
  getStatus: (serverId: string) => ConnectionStatus;
  checkNow: (server: Server) => Promise<void>;
  registerLogCallback: (serverId: string, callback: ConnectionLogCallback) => () => void;
}

const ServerStatusContext = createContext<ServerStatusContextValue | null>(null);

const INTERVAL_DISCONNECTED = 3000;
const INTERVAL_CONNECTED = 10000;
const INTERVAL_ERROR = 5000;

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const ServerStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const servers = useStore((state) => state.servers);
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const checkingRef = useRef<Record<string, boolean>>({});
  const logCallbacksRef = useRef<Record<string, ConnectionLogCallback[]>>({});

  const emitLog = useCallback((serverId: string, entry: ConnectionLogEntry) => {
    const callbacks = logCallbacksRef.current[serverId];
    if (callbacks) {
      callbacks.forEach(cb => cb(entry));
    }
  }, []);

  const checkServer = useCallback(async (server: Server) => {
    if (checkingRef.current[server.id]) return;
    
    checkingRef.current[server.id] = true;
    setStatuses((prev) => ({
      ...prev,
      [server.id]: 'checking',
    }));

    const result = await checkServerHealth(server);
    
    const logEntry: ConnectionLogEntry = {
      id: generateId(),
      serverId: server.id,
      timestamp: new Date().toISOString(),
      status: result.status === 'connected' ? 'success' : 'failed',
      errorType: result.errorType,
      httpCode: result.httpCode,
      errorMessage: result.errorMessage,
      latencyMs: result.latencyMs,
    };
    
    emitLog(server.id, logEntry);
    
    setStatuses((prev) => ({
      ...prev,
      [server.id]: result.status,
    }));
    checkingRef.current[server.id] = false;
  }, [emitLog]);

  const startPolling = useCallback((server: Server) => {
    if (intervalsRef.current[server.id]) {
      clearInterval(intervalsRef.current[server.id]);
    }

    checkServer(server);

    const getInterval = () => {
      const status = statuses[server.id];
      if (status === 'connected') return INTERVAL_CONNECTED;
      if (status === 'error') return INTERVAL_ERROR;
      return INTERVAL_DISCONNECTED;
    };

    let interval = getInterval();

    const poll = () => {
      const newInterval = getInterval();
      if (newInterval !== interval) {
        interval = newInterval;
        if (intervalsRef.current[server.id]) {
          clearInterval(intervalsRef.current[server.id]);
        }
        intervalsRef.current[server.id] = setInterval(() => {
          checkServer(server);
        }, interval);
      }
    };

    intervalsRef.current[server.id] = setInterval(() => {
      poll();
      checkServer(server);
    }, interval);
  }, [checkServer, statuses]);

  const stopPolling = useCallback((serverId: string) => {
    if (intervalsRef.current[serverId]) {
      clearInterval(intervalsRef.current[serverId]);
      delete intervalsRef.current[serverId];
    }
    delete checkingRef.current[serverId];
  }, []);

  useEffect(() => {
    const currentServerIds = new Set(servers.map((s) => s.id));
    
    servers.forEach((server) => {
      if (!intervalsRef.current[server.id]) {
        startPolling(server);
      }
    });

    Object.keys(intervalsRef.current).forEach((serverId) => {
      if (!currentServerIds.has(serverId)) {
        stopPolling(serverId);
        setStatuses((prev) => {
          const next = { ...prev };
          delete next[serverId];
          return next;
        });
      }
    });
  }, [servers, startPolling, stopPolling]);

  useEffect(() => {
    return () => {
      Object.keys(intervalsRef.current).forEach((serverId) => {
        clearInterval(intervalsRef.current[serverId]);
      });
    };
  }, []);

  useEffect(() => {
    servers.forEach((server) => {
      const currentStatus = statuses[server.id];
      if (currentStatus && currentStatus !== 'checking') {
        const currentInterval = intervalsRef.current[server.id];
        if (currentInterval) {
          clearInterval(currentInterval);
          let newInterval = INTERVAL_DISCONNECTED;
          if (currentStatus === 'connected') newInterval = INTERVAL_CONNECTED;
          else if (currentStatus === 'error') newInterval = INTERVAL_ERROR;
          
          intervalsRef.current[server.id] = setInterval(() => {
            checkServer(server);
          }, newInterval);
        }
      }
    });
  }, [statuses, servers, checkServer]);

  const getStatus = useCallback((serverId: string): ConnectionStatus => {
    return statuses[serverId] || 'disconnected';
  }, [statuses]);

  const checkNow = useCallback(async (server: Server) => {
    await checkServer(server);
  }, [checkServer]);

  const registerLogCallback = useCallback((serverId: string, callback: ConnectionLogCallback): (() => void) => {
    if (!logCallbacksRef.current[serverId]) {
      logCallbacksRef.current[serverId] = [];
    }
    logCallbacksRef.current[serverId].push(callback);
    
    return () => {
      logCallbacksRef.current[serverId] = logCallbacksRef.current[serverId].filter(cb => cb !== callback);
    };
  }, []);

  return (
    <ServerStatusContext.Provider value={{ statuses, getStatus, checkNow, registerLogCallback }}>
      {children}
    </ServerStatusContext.Provider>
  );
};

export const useServerStatusContext = (): ServerStatusContextValue => {
  const context = useContext(ServerStatusContext);
  if (!context) {
    throw new Error('useServerStatusContext must be used within a ServerStatusProvider');
  }
  return context;
};