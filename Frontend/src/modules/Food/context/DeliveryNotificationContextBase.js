import { createContext, useContext } from 'react';

export const DEFAULT_DELIVERY_NOTIFICATIONS = Object.freeze({
  newOrder: null,
  clearNewOrder: () => {},
  orderReady: null,
  clearOrderReady: () => {},
  orderStatusUpdate: null,
  clearOrderStatusUpdate: () => {},
  adminNotification: null,
  clearAdminNotification: () => {},
  claimedOrderId: null,
  clearClaimedOrderId: () => {},
  autoKilledOrder: null,
  clearAutoKilledOrder: () => {},
  isConnected: false,
  playNotificationSound: () => {},
  emitLocation: () => false,
});

export const DeliveryNotificationContext = createContext(DEFAULT_DELIVERY_NOTIFICATIONS);

export const useDeliveryNotifications = () => {
  const context = useContext(DeliveryNotificationContext);
  return context || DEFAULT_DELIVERY_NOTIFICATIONS;
};

export const useDeliveryNotificationContext = useDeliveryNotifications;
