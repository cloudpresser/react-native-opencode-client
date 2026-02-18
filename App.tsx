import React, { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Uniwind, withUniwind } from 'uniwind';

const StyledView = withUniwind(View);
import ServersScreen from './src/screens/servers/ServersScreen';
import SessionsScreen from './src/screens/sessions/SessionsScreen';
import SessionDetailScreen from './src/screens/session-detail/SessionDetailScreen';
import AddEditServerScreen from './src/screens/servers/AddEditServerScreen';
import NewSessionScreen from './src/screens/sessions/NewSessionScreen';
import GitDiffViewerScreen from './src/screens/git/GitDiffViewerScreen';
import { RootStackParamList } from './src/navigation/types';
import { useStore } from './src/store';
import { ServerStatusProvider } from './src/context/ServerStatusContext';
import './src/global.css';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const systemColorScheme = useColorScheme();
  const { theme, loadTheme, setTheme } = useStore();

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    if (theme === 'system') {
      Uniwind.setTheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      Uniwind.setTheme(theme);
    }
  }, [theme, systemColorScheme]);

  const navigationTheme = systemColorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <SafeAreaProvider>
      <ServerStatusProvider>
        <StyledView className="flex-1 bg-background">
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style={systemColorScheme === 'dark' ? 'light' : 'dark'} />
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
            </Stack.Navigator>
          </NavigationContainer>
        </StyledView>
      </ServerStatusProvider>
    </SafeAreaProvider>
  );
}