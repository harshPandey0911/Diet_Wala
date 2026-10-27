import React from 'react';
import { useUserNotificationsState } from '../hooks/useUserNotifications';
import {
  UserNotificationContext,
  DEFAULT_USER_NOTIFICATIONS,
  useUserNotifications,
  useUserNotificationContext
} from './UserNotificationContextBase';

export {
  UserNotificationContext,
  DEFAULT_USER_NOTIFICATIONS,
  useUserNotifications,
  useUserNotificationContext
};

export const UserNotificationProvider = ({ children }) => {
  const notifications = useUserNotificationsState();

  return (
    <UserNotificationContext.Provider value={notifications}>
      {children}
    </UserNotificationContext.Provider>
  );
};
