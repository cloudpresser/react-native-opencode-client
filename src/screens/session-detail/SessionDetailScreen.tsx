import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import ChatTab from '../../components/chat/ChatTab';
import GitViewerTab from '../../components/git-viewer/GitViewerTab';
import TerminalTab from '../../components/terminal/TerminalTab';
import FileAnnotationTab from '../../components/file-annotation/FileAnnotationTab';

type SessionDetailRouteProp = RouteProp<RootStackParamList, 'SessionDetail'>;

const Tab = createBottomTabNavigator();

export default function SessionDetailScreen() {
  const route = useRoute<SessionDetailRouteProp>();
  const { session, server } = route.params;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#666',
        headerShown: true,
        headerTitle: session.title,
      }}
    >
      <Tab.Screen
        name="Chat"
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <View style={[styles.icon, { backgroundColor: color }]} />,
        }}
      >
        {() => <ChatTab session={session} server={server} />}
      </Tab.Screen>

      <Tab.Screen
        name="GitViewer"
        options={{
          tabBarLabel: 'Git',
          tabBarIcon: ({ color }) => <View style={[styles.icon, { backgroundColor: color }]} />,
        }}
      >
        {() => <GitViewerTab session={session} server={server} />}
      </Tab.Screen>

      <Tab.Screen
        name="Terminal"
        options={{
          tabBarLabel: 'Terminal',
          tabBarIcon: ({ color }) => <View style={[styles.icon, { backgroundColor: color }]} />,
        }}
      >
        {() => <TerminalTab session={session} server={server} />}
      </Tab.Screen>

      <Tab.Screen
        name="FileAnnotation"
        options={{
          tabBarLabel: 'Annotate',
          tabBarIcon: ({ color }) => <View style={[styles.icon, { backgroundColor: color }]} />,
        }}
      >
        {() => <FileAnnotationTab session={session} server={server} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    height: 60,
  },
  icon: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
