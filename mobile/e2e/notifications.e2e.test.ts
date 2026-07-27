/**
 * E2E device tests for push notification handling.
 *
 * Covers:
 *  1. Push notification registration flow
 *  2. Local notification scheduling
 *  3. Foreground notification handling
 *  4. Notification tap → navigation for trade events
 *
 * These tests mock expo-notifications and SecureStore so they run on CI
 * without requiring an actual device push service.
 */

jest.mock('expo-notifications', () => {
  const mockState: { permissions: { status: string }; token: string; scheduled: Array<{ title: string; body: string }> } = {
    permissions: { status: 'granted' },
    token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    scheduled: [],
  };

  return {
    __esModule: true,
    getPermissionsAsync: jest.fn(async () => mockState.permissions),
    requestPermissionsAsync: jest.fn(async () => mockState.permissions),
    getExpoPushTokenAsync: jest.fn(async () => ({ data: mockState.token })),
    scheduleNotificationAsync: jest.fn(async (opts: { content: { title: string; body: string } }) => {
      const id = `local-${Date.now()}`;
      mockState.scheduled.push({ title: opts.content.title, body: opts.content.body });
      return id;
    }),
    setNotificationHandler: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    setNotificationChannelAsync: jest.fn(),
    AndroidImportance: { MAX: 5 },
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  scheduleLocalNotification,
  setupNotificationListeners,
  setupForegroundNotificationHandler,
  checkNotificationPermissions,
  getStoredPushToken,
} from '../src/services/notification.service';

describe('Push Notification E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers for push notifications and returns a token', async () => {
    const token = await registerForPushNotifications();

    expect(token).toBe('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled();
  });

  it('returns null when permissions are denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    const token = await registerForPushNotifications();

    expect(token).toBeNull();
  });

  it('schedules a local notification and returns an identifier', async () => {
    const id = await scheduleLocalNotification(
      'Trade Funded',
      'Trade #123 has been funded on escrow.',
      { type: 'trade', tradeId: '123' },
    );

    expect(id).toBeTruthy();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Trade Funded',
          body: 'Trade #123 has been funded on escrow.',
          data: { type: 'trade', tradeId: '123' },
        }),
        trigger: null,
      }),
    );
  });

  it('sets up foreground notification handler and returns cleanup function', () => {
    const handler = jest.fn();
    const cleanup = setupForegroundNotificationHandler(handler);

    expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(handler);
    expect(cleanup).toBeInstanceOf(Function);
  });

  it('sets up notification tap listener and returns cleanup function', () => {
    const onTap = jest.fn();
    const cleanup = setupNotificationListeners(onTap);

    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    expect(cleanup).toBeInstanceOf(Function);
  });

  it('checks notification permissions and returns grant status', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });

    const granted = await checkNotificationPermissions();
    expect(granted).toBe(true);
  });

  it('returns false when notification permissions are denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    const granted = await checkNotificationPermissions();
    expect(granted).toBe(false);
  });

  it('retrieves stored push token', async () => {
    const SecureStore = require('expo-secure-store');
    SecureStore.getItemAsync.mockResolvedValueOnce('stored-expo-token-123');

    const token = await getStoredPushToken();
    expect(token).toBe('stored-expo-token-123');
  });

  it('schedules notification with dispute type metadata', async () => {
    const id = await scheduleLocalNotification(
      'Dispute Initiated',
      'A dispute has been raised for trade #456.',
      { type: 'dispute', tradeId: '456', disputeId: 'd-789' },
    );

    expect(id).toBeTruthy();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { type: 'dispute', tradeId: '456', disputeId: 'd-789' },
        }),
      }),
    );
  });

  it('schedules notification with screen navigation data', async () => {
    const id = await scheduleLocalNotification(
      'Evidence Required',
      'Upload evidence for trade #789.',
      { type: 'trade', tradeId: '789', screen: 'EvidenceCapture' },
    );

    expect(id).toBeTruthy();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { type: 'trade', tradeId: '789', screen: 'EvidenceCapture' },
        }),
      }),
    );
  });
});
