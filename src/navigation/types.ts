import { NavigatorScreenParams } from '@react-navigation/native';
import { Server, Session, GitFile } from '../types';

export type RootStackParamList = {
  Servers: undefined;
  AddEditServer: { server?: Server };
  Sessions: { server: Server };
  NewSession: { server: Server };
  SessionDetail: { session: Session; server: Server };
  GitDiffViewer: { file: GitFile; session: Session; server: Server };
  ConnectionLogs: { serverId: string; serverName: string };
};

export type SessionDetailTabParamList = {
  Chat: { session: Session; server: Server };
  GitViewer: { session: Session; server: Server };
  Terminal: { session: Session; server: Server };
  FileAnnotation: { session: Session; server: Server };
};
