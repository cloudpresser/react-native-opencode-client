import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Server, Session, ChatMessage, GitFile, FileAnnotation, Project } from '../types';

type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  // Theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;

  // Servers
  servers: Server[];
  selectedServer: Server | null;
  addServer: (server: Server) => Promise<void>;
  updateServer: (id: string, server: Partial<Server>) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  selectServer: (server: Server | null) => void;
  loadServers: () => Promise<void>;

  // Projects
  projects: Project[];
  selectedProject: Project | null;
  openProject: (project: Project) => Promise<void>;
  closeProject: (serverId: string, worktree: string) => Promise<void>;
  selectProject: (project: Project | null) => void;
  enrichProjects: (serverId: string, apiProjects: Project[]) => Promise<void>;
  loadProjects: (serverId: string) => Promise<void>;

  // Sessions
  sessions: Session[];
  selectedSession: Session | null;
  addSession: (session: Session) => Promise<void>;
  updateSession: (id: string, session: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  selectSession: (session: Session | null) => void;
  loadSessions: (serverId: string) => Promise<void>;

  // Chat
  messages: Record<string, ChatMessage[]>;
  hasMoreMessages: Record<string, boolean>;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  prependMessages: (sessionId: string, messages: ChatMessage[]) => void;
  setHasMoreMessages: (sessionId: string, hasMore: boolean) => void;
  clearMessages: (sessionId: string) => void;

  // Notification suppression
  viewedSessionId: string | null;
  setViewedSessionId: (id: string | null) => void;

  // Git Files
  gitFiles: Record<string, GitFile[]>;
  setGitFiles: (sessionId: string, files: GitFile[]) => void;

  // File Annotations
  fileAnnotations: Record<string, FileAnnotation[]>;
  addFileAnnotation: (sessionId: string, annotation: FileAnnotation) => void;
  removeFileAnnotation: (sessionId: string, filePath: string) => void;
  clearFileAnnotations: (sessionId: string) => void;
}

const SERVERS_KEY = '@opencode_servers';
const PROJECTS_KEY = '@opencode_projects';
const SESSIONS_KEY = '@opencode_sessions';
const MESSAGES_KEY = '@opencode_messages';
const THEME_KEY = '@opencode_theme';

export const useStore = create<AppState>((set, get) => ({
  // Theme
  theme: 'system',
  
  setTheme: async (theme: ThemeMode) => {
    set({ theme });
    await AsyncStorage.setItem(THEME_KEY, theme);
  },
  
  loadTheme: async () => {
    const data = await AsyncStorage.getItem(THEME_KEY);
    if (data) {
      set({ theme: data as ThemeMode });
    }
  },

  // Servers
  servers: [],
  selectedServer: null,
  
  addServer: async (server: Server) => {
    const existing = get().servers.find(s => s.name === server.name);
    let servers;
    if (existing) {
      // Update existing server with the same name instead of creating a duplicate
      servers = get().servers.map(s => s.name === server.name ? { ...s, ...server, id: s.id } : s);
    } else {
      servers = [...get().servers, server];
    }
    set({ servers });
    await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
  },
  
  updateServer: async (id: string, updates: Partial<Server>) => {
    const servers = get().servers.map(s => s.id === id ? { ...s, ...updates } : s);
    set({ servers });
    await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
  },
  
  deleteServer: async (id: string) => {
    const servers = get().servers.filter(s => s.id !== id);
    set({ servers });
    await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
  },
  
  selectServer: (server: Server | null) => set({ selectedServer: server }),
  
  loadServers: async () => {
    const data = await AsyncStorage.getItem(SERVERS_KEY);
    if (data) {
      set({ servers: JSON.parse(data) });
    }
  },

  // Projects
  projects: [],
  selectedProject: null,

  openProject: async (project: Project) => {
    const existing = get().projects;
    // Deduplicate by worktree + serverId
    if (existing.find(p => p.worktree === project.worktree && p.serverId === project.serverId)) {
      return;
    }
    const projects = [...existing, project];
    set({ projects });
    await AsyncStorage.setItem(`${PROJECTS_KEY}_${project.serverId}`, JSON.stringify(projects));
  },

  closeProject: async (serverId: string, worktree: string) => {
    const projects = get().projects.filter(p => !(p.worktree === worktree && p.serverId === serverId));
    set({ projects });
    await AsyncStorage.setItem(`${PROJECTS_KEY}_${serverId}`, JSON.stringify(projects));
  },

  selectProject: (project: Project | null) => set({ selectedProject: project }),

  enrichProjects: async (serverId: string, apiProjects: Project[]) => {
    const current = get().projects;
    const enriched = current.map(p => {
      if (p.serverId !== serverId) return p;
      const match = apiProjects.find(ap => ap.worktree === p.worktree);
      if (!match) return p;
      return {
        ...p,
        id: match.id,
        vcs: match.vcs,
        vcsDir: match.vcsDir,
        createdAt: match.createdAt ?? p.createdAt,
        initializedAt: match.initializedAt ?? p.initializedAt,
      };
    });
    set({ projects: enriched });
    await AsyncStorage.setItem(`${PROJECTS_KEY}_${serverId}`, JSON.stringify(enriched));
  },

  loadProjects: async (serverId: string) => {
    const data = await AsyncStorage.getItem(`${PROJECTS_KEY}_${serverId}`);
    if (data) {
      set({ projects: JSON.parse(data) });
    } else {
      set({ projects: [] });
    }
  },

  // Sessions
  sessions: [],
  selectedSession: null,
  
  addSession: async (session: Session) => {
    const sessions = [...get().sessions, session];
    set({ sessions });
    await AsyncStorage.setItem(`${SESSIONS_KEY}_${session.serverId}`, JSON.stringify(sessions));
  },
  
  updateSession: async (id: string, updates: Partial<Session>) => {
    const sessions = get().sessions.map(s => s.id === id ? { ...s, ...updates } : s);
    set({ sessions });
    const serverId = sessions.find(s => s.id === id)?.serverId;
    if (serverId) {
      await AsyncStorage.setItem(`${SESSIONS_KEY}_${serverId}`, JSON.stringify(sessions));
    }
  },
  
  deleteSession: async (id: string) => {
    const sessions = get().sessions.filter(s => s.id !== id);
    set({ sessions });
    const serverId = get().selectedServer?.id;
    if (serverId) {
      await AsyncStorage.setItem(`${SESSIONS_KEY}_${serverId}`, JSON.stringify(sessions));
    }
  },
  
  selectSession: (session: Session | null) => set({ selectedSession: session }),
  
  loadSessions: async (serverId: string) => {
    const data = await AsyncStorage.getItem(`${SESSIONS_KEY}_${serverId}`);
    if (data) {
      set({ sessions: JSON.parse(data) });
    } else {
      set({ sessions: [] });
    }
  },

  // Chat
  messages: {},
  hasMoreMessages: {},
  
  addMessage: (sessionId: string, message: ChatMessage) => {
    const messages = get().messages;
    const sessionMessages = messages[sessionId] || [];
    const updated = { ...messages, [sessionId]: [...sessionMessages, message] };
    set({ messages: updated });
  },
  
  setMessages: (sessionId: string, newMessages: ChatMessage[]) => {
    const messages = get().messages;
    set({ messages: { ...messages, [sessionId]: newMessages } });
  },
  
  prependMessages: (sessionId: string, olderMessages: ChatMessage[]) => {
    const messages = get().messages;
    const sessionMessages = messages[sessionId] || [];
    set({ messages: { ...messages, [sessionId]: [...olderMessages, ...sessionMessages] } });
  },
  
  setHasMoreMessages: (sessionId: string, hasMore: boolean) => {
    const hasMoreMessages = get().hasMoreMessages;
    set({ hasMoreMessages: { ...hasMoreMessages, [sessionId]: hasMore } });
  },
  
  clearMessages: (sessionId: string) => {
    const messages = { ...get().messages };
    const hasMoreMessages = { ...get().hasMoreMessages };
    delete messages[sessionId];
    delete hasMoreMessages[sessionId];
    set({ messages, hasMoreMessages });
  },

  // Notification suppression
  viewedSessionId: null,
  setViewedSessionId: (id: string | null) => set({ viewedSessionId: id }),

  // Git Files
  gitFiles: {},
  
  setGitFiles: (sessionId: string, files: GitFile[]) => {
    const gitFiles = { ...get().gitFiles, [sessionId]: files };
    set({ gitFiles });
  },

  // File Annotations
  fileAnnotations: {},
  
  addFileAnnotation: (sessionId: string, annotation: FileAnnotation) => {
    const annotations = get().fileAnnotations[sessionId] || [];
    const filtered = annotations.filter(a => a.filePath !== annotation.filePath);
    const updated = { ...get().fileAnnotations, [sessionId]: [...filtered, annotation] };
    set({ fileAnnotations: updated });
  },
  
  removeFileAnnotation: (sessionId: string, filePath: string) => {
    const annotations = (get().fileAnnotations[sessionId] || []).filter(a => a.filePath !== filePath);
    set({ fileAnnotations: { ...get().fileAnnotations, [sessionId]: annotations } });
  },
  
  clearFileAnnotations: (sessionId: string) => {
    const fileAnnotations = { ...get().fileAnnotations };
    delete fileAnnotations[sessionId];
    set({ fileAnnotations });
  },
}));
