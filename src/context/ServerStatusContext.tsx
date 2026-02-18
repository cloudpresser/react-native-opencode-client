import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Server, ConnectionStatus } from '../types';
import { checkServerHealth } from '../services/serverStatus';
import { useStore } from '../store';

interface ServerStatusContextValue {
  statuses: Record<string, ConnectionStatus>;
  getStatus: (serverId: string) => ConnectionStatus;
  checkNow: (server: Server) => Promise<void>;
}

const ServerStatusContext = createContext<ServerStatusContextValue | null>(null);

const INTERVAL_DISCONNECTED = 3000;
const INTERVAL_CONNECTED = 10000;

export const ServerStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const servers = useStore((state) => state.servers);
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const checkingRef = useRef<Record<string, boolean>>({});

  const checkServer = useCallback(async (server: Server) => {
    if (checkingRef.current[server.id]) return;
    
    checkingRef.current[server.id] = true;
    setStatuses((prev) => ({
      ...prev,
      [server.id]: 'checking',
    }));

    const status = await checkServerHealth(server);
    
    setStatuses((prev) => ({
      ...prev,
      [server.id]: status,
    }));
    checkingRef.current[server.id] = false;
  }, []);

  const startPolling = useCallback((server: Server) => {
    if (intervalsRef.current[server.id]) {
      clearInterval(intervalsRef.current[server.id]);
    }

    checkServer(server);

    const getInterval = () => {
      const status = statuses[server.id];
      return status === 'connected' ? INTERVAL_CONNECTED : INTERVAL_DISCONNECTED;
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
          const newInterval = currentStatus === 'connected' ? INTERVAL_CONNECTED : INTERVAL_DISCONNECTED;
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

  return (
    <ServerStatusContext.Provider value={{ statuses, getStatus, checkNow }}>
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