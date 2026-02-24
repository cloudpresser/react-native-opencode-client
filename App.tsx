import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import * as Notifications from 'expo-notifications';

const StyledView = withUniwind(View);
import ServersScreen from './src/screens/servers/ServersScreen';
import ProjectsScreen from './src/screens/projects/ProjectsScreen';
import SelectDirectoryScreen from './src/screens/projects/SelectDirectoryScreen';
import SessionsScreen from './src/screens/sessions/SessionsScreen';
import SessionDetailScreen from './src/screens/session-detail/SessionDetailScreen';
import AddEditServerScreen from './src/screens/servers/AddEditServerScreen';
import NewSessionScreen from './src/screens/sessions/NewSessionScreen';
import GitDiffViewerScreen from './src/screens/git/GitDiffViewerScreen';
import ConnectionLogsScreen from './src/screens/servers/ConnectionLogsScreen';
import { RootStackParamList } from './src/navigation/types';
import { ServerStatusProvider } from './src/context/ServerStatusContext';
import { NotificationProvider } from './src/context/NotificationProvider';
import { NotificationData } from './src/services/notifications';
import { useStore } from './src/store';
import './src/global.css';

// Import background task at module level so defineTask runs before React renders
import { registerBackgroundPoll } from './src/tasks/backgroundPoll';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const { servers, sessions } = useStore();

  // Register background poll task on mount
  useEffect(() => {
    registerBackgroundPoll();
  }, []);

  // Handle notification taps — navigate to the relevant session
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as unknown as NotificationData;
        if (!data?.sessionId || !data?.serverId) return;

        const server = servers.find((s) => s.id === data.serverId);
        const session = sessions.find((s) => s.id === data.sessionId);

        if (server && session && navigationRef.current) {
          navigationRef.current.navigate('SessionDetail', { session, server });
        }
      },
    );

    return () => subscription.remove();
  }, [servers, sessions]);

  return (
    <SafeAreaProvider>
      <ServerStatusProvider>
        <NotificationProvider>
          <StyledView className="flex-1 bg-background">
            <NavigationContainer ref={navigationRef} theme={DarkTheme}>
              <StatusBar style="light" />
              <Stack.Navigator
                initialRouteName="Servers"
                screenOptions={{
                  headerShown: false,
                }}
              >
                <Stack.Screen name="Servers" component={ServersScreen} />
                <Stack.Screen name="Projects" component={ProjectsScreen} />
                <Stack.Screen name="SelectDirectory" component={SelectDirectoryScreen} />
                <Stack.Screen name="Sessions" component={SessionsScreen} />
                <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
                <Stack.Screen name="AddEditServer" component={AddEditServerScreen} />
                <Stack.Screen name="NewSession" component={NewSessionScreen} />
                <Stack.Screen name="GitDiffViewer" component={GitDiffViewerScreen} />
                <Stack.Screen name="ConnectionLogs" component={ConnectionLogsScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </StyledView>
        </NotificationProvider>
      </ServerStatusProvider>
    </SafeAreaProvider>
  );
}