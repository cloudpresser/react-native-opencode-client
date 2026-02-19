import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

const StyledView = withUniwind(View);
import ServersScreen from './src/screens/servers/ServersScreen';
import SessionsScreen from './src/screens/sessions/SessionsScreen';
import SessionDetailScreen from './src/screens/session-detail/SessionDetailScreen';
import AddEditServerScreen from './src/screens/servers/AddEditServerScreen';
import NewSessionScreen from './src/screens/sessions/NewSessionScreen';
import GitDiffViewerScreen from './src/screens/git/GitDiffViewerScreen';
import ConnectionLogsScreen from './src/screens/servers/ConnectionLogsScreen';
import { RootStackParamList } from './src/navigation/types';
import { ServerStatusProvider } from './src/context/ServerStatusContext';
import './src/global.css';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <ServerStatusProvider>
        <StyledView className="flex-1 bg-background">
          <NavigationContainer theme={DarkTheme}>
            <StatusBar style="light" />
            <Stack.Navigator
              initialRouteName="Servers"
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="Servers" component={ServersScreen} />
              <Stack.Screen name="Sessions" component={SessionsScreen} />
              <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
              <Stack.Screen name="AddEditServer" component={AddEditServerScreen} />
              <Stack.Screen name="NewSession" component={NewSessionScreen} />
              <Stack.Screen name="GitDiffViewer" component={GitDiffViewerScreen} />
              <Stack.Screen name="ConnectionLogs" component={ConnectionLogsScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </StyledView>
      </ServerStatusProvider>
    </SafeAreaProvider>
  );
}