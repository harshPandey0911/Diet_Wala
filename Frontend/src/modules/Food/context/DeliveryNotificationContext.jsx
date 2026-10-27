import React from 'react';
import { useDeliveryNotificationsState } from '../hooks/useDeliveryNotifications';
import {
  DeliveryNotificationContext,
  DEFAULT_DELIVERY_NOTIFICATIONS,
  useDeliveryNotifications,
  useDeliveryNotificationContext
} from './DeliveryNotificationContextBase';

export {
  DeliveryNotificationContext,
  DEFAULT_DELIVERY_NOTIFICATIONS,
  useDeliveryNotifications,
  useDeliveryNotificationContext
};

export const DeliveryNotificationProvider = ({ children }) => {
  const notifications = useDeliveryNotificationsState();

  return (
    <DeliveryNotificationContext.Provider value={notifications}>
      {children}
    </DeliveryNotificationContext.Provider>
  );
};
