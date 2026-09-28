import React from 'react';
import { useRestaurantNotificationsState } from '../hooks/useRestaurantNotifications';
import {
  RestaurantNotificationContext,
  DEFAULT_RESTAURANT_NOTIFICATIONS,
  useRestaurantNotifications,
  useRestaurantNotificationContext
} from './RestaurantNotificationContextBase';

export {
  RestaurantNotificationContext,
  DEFAULT_RESTAURANT_NOTIFICATIONS,
  useRestaurantNotifications,
  useRestaurantNotificationContext
};

export const RestaurantNotificationProvider = ({ children }) => {
  const notifications = useRestaurantNotificationsState();

  return (
    <RestaurantNotificationContext.Provider value={notifications}>
      {children}
    </RestaurantNotificationContext.Provider>
  );
};
