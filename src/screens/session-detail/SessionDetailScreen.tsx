import React from 'react';
import { View, TouchableOpacity, Text, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useStore } from '../../store';
import ChatTab from '../../components/chat/ChatTab';
import GitViewerTab from '../../components/git-viewer/GitViewerTab';
import TerminalTab from '../../components/terminal/TerminalTab';
import FileAnnotationTab from '../../components/file-annotation/FileAnnotationTab';

type SessionDetailRouteProp = RouteProp<RootStackParamList, 'SessionDetail'>;

const Tab = createBottomTabNavigator();

export default function SessionDetailScreen() {
  const route = useRoute<SessionDetailRouteProp>();
  const { session, server } = route.params;
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { deleteSession, clearMessages } = useStore();

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        clearMessages(session.id);
      };
    }, [session.id, clearMessages])
  );

  const handleDeleteSession = () => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete "${session.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(session.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: true,
        headerTitle: session.title,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerRight: () => (
          <TouchableOpacity
            testID="session-delete-btn"
            onPress={handleDeleteSession}
            className="mr-4"
          >
            <Text style={{ color: colors.danger }}>Delete</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tab.Screen
        name="Chat"
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />,
        }}
      >
        {() => <ChatTab session={session} server={server} />}
      </Tab.Screen>

      <Tab.Screen
        name="GitViewer"
        options={{
          tabBarLabel: 'Git',
          tabBarIcon: ({ color }) => <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />,
        }}
      >
        {() => <GitViewerTab session={session} server={server} />}
      </Tab.Screen>

      <Tab.Screen
        name="Terminal"
        options={{
          tabBarLabel: 'Terminal',
          tabBarIcon: ({ color }) => <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />,
        }}
      >
        {() => <TerminalTab session={session} server={server} />}
      </Tab.Screen>

      <Tab.Screen
        name="FileAnnotation"
        options={{
          tabBarLabel: 'Annotate',
          tabBarIcon: ({ color }) => <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />,
        }}
      >
        {() => <FileAnnotationTab session={session} server={server} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}