import { createContext, useContext } from 'react';

export const DEFAULT_RESTAURANT_NOTIFICATIONS = Object.freeze({
  newOrder: null,
  orderQueue: [],
  newReservation: null,
  pickupOtpReveal: null,
  clearPickupOtpReveal: () => {},
  clearNewOrder: () => {},
  clearNewReservation: () => {},
  isConnected: false,
  playNotificationSound: () => {},
});

export const RestaurantNotificationContext = createContext(DEFAULT_RESTAURANT_NOTIFICATIONS);

export const useRestaurantNotifications = () => {
  const context = useContext(RestaurantNotificationContext);
  return context || DEFAULT_RESTAURANT_NOTIFICATIONS;
};

export const useRestaurantNotificationContext = useRestaurantNotifications;
