import { createContext, useContext } from 'react';

export const DEFAULT_USER_NOTIFICATIONS = Object.freeze({
  isConnected: false,
});

export const UserNotificationContext = createContext(DEFAULT_USER_NOTIFICATIONS);

export const useUserNotifications = () => {
  const context = useContext(UserNotificationContext);
  return context || DEFAULT_USER_NOTIFICATIONS;
};

export const useUserNotificationContext = useUserNotifications;
