import { NavigatorScreenParams } from '@react-navigation/native';
import { Server, Session } from '../types';

export type RootStackParamList = {
  Servers: undefined;
  Sessions: { server: Server };
  SessionDetail: { session: Session; server: Server };
};

export type SessionDetailTabParamList = {
  Chat: { session: Session; server: Server };
  GitViewer: { session: Session; server: Server };
  Terminal: { session: Session; server: Server };
  FileAnnotation: { session: Session; server: Server };
};
