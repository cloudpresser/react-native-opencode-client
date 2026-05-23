import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const CHANNEL_ID = 'opencode-default';

export type NotificationType = 'agent-active' | 'agent-finished' | 'question-asked' | 'permission-asked';

export interface NotificationData {
  sessionId: string;
  serverId: string;
  type: NotificationType;
}

class NotificationService {
  private initialized = false;

  /**
   * Set up the foreground notification handler and Android channel.
   * Must be called early (e.g. module scope or App mount).
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Show notifications even when the app is foregrounded
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'OpenCode',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7aa2f7',
      });
    }
  }

  /**
   * Request notification permissions from the user.
   * Returns true if granted.
   */
  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('Notifications require a physical device');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Fire an immediate local notification.
   * Returns the notification identifier (for later cancellation).
   */
  async notify(
    title: string,
    body: string,
    data: NotificationData,
  ): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data as unknown as Record<string, unknown>,
        sound: 'default',
      },
      trigger: null, // immediate
    });
  }

  /** Fire a "agent is active" notification */
  async notifyAgentActive(sessionId: string, serverId: string, sessionTitle: string): Promise<string> {
    return this.notify(
      'Agent is responding',
      `Activity in "${sessionTitle}"`,
      { sessionId, serverId, type: 'agent-active' },
    );
  }

  /** Fire a "agent finished" notification */
  async notifyAgentFinished(sessionId: string, serverId: string, sessionTitle: string): Promise<string> {
    return this.notify(
      'Agent finished',
      `Completed in "${sessionTitle}"`,
      { sessionId, serverId, type: 'agent-finished' },
    );
  }

  /** Fire a "question asked" notification */
  async notifyQuestionAsked(
    sessionId: string,
    serverId: string,
    sessionTitle: string,
    header: string,
  ): Promise<string> {
    return this.notify(
      'Agent needs your input',
      header ? `${header} - "${sessionTitle}"` : `Question in "${sessionTitle}"`,
      { sessionId, serverId, type: 'question-asked' },
    );
  }

  /** Fire a "permission asked" notification */
  async notifyPermissionAsked(
    sessionId: string,
    serverId: string,
    sessionTitle: string,
    header?: string,
  ): Promise<string> {
    return this.notify(
      'Agent needs approval',
      header ? `${header} - "${sessionTitle}"` : `Permission requested in "${sessionTitle}"`,
      { sessionId, serverId, type: 'permission-asked' },
    );
  }

  /** Dismiss all delivered notifications for a given session */
  async dismissAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }
}

/** Singleton instance */
export const notificationService = new NotificationService();
