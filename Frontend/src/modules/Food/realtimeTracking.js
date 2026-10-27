import { onValue, ref, set, update } from 'firebase/database';
import { firebaseRealtimeDb, ensureFirebaseInitialized } from '@food/firebase';

function sanitizeRealtimeKey(value) {
  return String(value || '').trim().replace(/[.#$/[\]]/g, '_');
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getDeliveryLocationPath(deliveryId) {
  return `delivery_boys/${sanitizeRealtimeKey(deliveryId)}`;
}

function getRestaurantLocationPath(restaurantId) {
  return `restaurant/${sanitizeRealtimeKey(restaurantId)}/location`;
}

function getOrderTrackingPath(orderId) {
  return `active_orders/${sanitizeRealtimeKey(orderId)}`;
}

function getDeliveryPartnerOffersPath(deliveryPartnerId) {
  return `delivery_partner_offers/${sanitizeRealtimeKey(deliveryPartnerId)}`;
}

export function subscribeDeliveryPartnerOffers(deliveryPartnerId, onChange, onError) {
  if (!deliveryPartnerId || typeof onChange !== 'function') return () => {};
  try {
    ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
    if (!firebaseRealtimeDb) return () => {};
    const path = getDeliveryPartnerOffersPath(deliveryPartnerId);
    const unsub = onValue(
      ref(firebaseRealtimeDb, path),
      (snapshot) => {
        onChange(snapshot.val() || {}, path);
      },
      (error) => {
        if (typeof onError === 'function') onError(error, path);
      },
    );
    return unsub;
  } catch (err) {
    console.warn('[FirebaseTracking] subscribeDeliveryPartnerOffers error:', err?.message || err);
    return () => {};
  }
}

export function subscribeOrderTracking(orderId, onChange, onError) {
  if (!orderId || typeof onChange !== 'function') return () => {};
  try {
    // Keep auth disabled on tracking pages to avoid identitytoolkit calls
    ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
    if (!firebaseRealtimeDb) return () => {};
    const path = getOrderTrackingPath(orderId);
    const unsub = onValue(
      ref(firebaseRealtimeDb, path),
      (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        onChange(data, path);
      },
      (error) => {
        if (typeof onError === 'function') onError(error, path);
      },
    );
    return unsub;
  } catch (err) {
    console.warn('[FirebaseTracking] subscribeOrderTracking error:', err?.message || err);
    return () => {};
  }
}

export function subscribeDeliveryLocation(deliveryId, onChange, onError) {
  if (!deliveryId || typeof onChange !== 'function') return () => {};
  try {
    ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
    if (!firebaseRealtimeDb) return () => {};
    const path = getDeliveryLocationPath(deliveryId);
    const unsub = onValue(
      ref(firebaseRealtimeDb, path),
      (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        onChange(data, path);
      },
      (error) => {
        if (typeof onError === 'function') onError(error, path);
      },
    );
    return unsub;
  } catch (err) {
    console.warn('[FirebaseTracking] subscribeDeliveryLocation error:', err?.message || err);
    return () => {};
  }
}

export function subscribeAllDeliveryLocations(onChange, onError) {
  if (typeof onChange !== 'function') return () => {};
  try {
    ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
    if (!firebaseRealtimeDb) return () => {};
    const path = 'delivery_boys';
    const unsub = onValue(
      ref(firebaseRealtimeDb, path),
      (snapshot) => {
        onChange(snapshot.val() || {}, path);
      },
      (error) => {
        if (typeof onError === 'function') onError(error, path);
      },
    );
    return unsub;
  } catch (err) {
    console.warn('[FirebaseTracking] subscribeAllDeliveryLocations error:', err?.message || err);
    return () => {};
  }
}

export function subscribeRestaurantLocation(restaurantId, onChange, onError) {
  if (!restaurantId || typeof onChange !== 'function') return () => {};
  try {
    ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
    if (!firebaseRealtimeDb) return () => {};
    const path = getRestaurantLocationPath(restaurantId);
    const unsub = onValue(
      ref(firebaseRealtimeDb, path),
      (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        onChange(data, path);
      },
      (error) => {
        if (typeof onError === 'function') onError(error, path);
      },
    );
    return unsub;
  } catch (err) {
    console.warn('[FirebaseTracking] subscribeRestaurantLocation error:', err?.message || err);
    return () => {};
  }
}

export async function writeDeliveryLocation({
  deliveryId,
  lat,
  lng,
  heading = 0,
  speed = 0,
  isOnline = true,
  activeOrderId = null,
  accuracy = null,
  timestamp = Date.now(),
  status = null,
}) {
  if (!deliveryId) return false;
  try {
    ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
    if (!firebaseRealtimeDb) return false;
    const payload = {
      lat: toFiniteNumber(lat),
      lng: toFiniteNumber(lng),
      heading: toFiniteNumber(heading) || 0,
      speed: toFiniteNumber(speed) || 0,
      accuracy: toFiniteNumber(accuracy),
      timestamp: toFiniteNumber(timestamp) || Date.now(),
      last_updated: Date.now(),
      isOnline: Boolean(isOnline),
      activeOrderId: activeOrderId ? String(activeOrderId) : null,
    };
    if (status != null) {
      payload.status = String(status);
    } else if (isOnline) {
      payload.status = 'online';
    } else {
      payload.status = 'offline';
    }
    await set(ref(firebaseRealtimeDb, getDeliveryLocationPath(deliveryId)), payload);
    return true;
  } catch (error) {
    console.warn('[FirebaseTracking] Direct client-side location write skipped (handled by socket server):', error?.message || error);
    return false;
  }
}

/**
 * Write order tracking data to Firebase at orders/{orderId}/tracking.
 * Used by the delivery app to publish rider location; user tracking page reads from the same path.
 * Payload should include: lat, lng, heading (or bearing), and optionally speed, polyline, route_coordinates.
 */
export async function writeOrderTracking(orderId, payload = {}) {
  if (!orderId) return false;
  try {
    ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
    if (!firebaseRealtimeDb) return false;
    const toWrite = {
      ...payload,
      lat: toFiniteNumber(payload.lat),
      lng: toFiniteNumber(payload.lng),
      heading: toFiniteNumber(payload.heading ?? payload.bearing) || 0,
      last_updated: Date.now(),
    };
    if (payload.timestamp != null) {
      toWrite.timestamp = toFiniteNumber(payload.timestamp) || Date.now();
    }
    await update(ref(firebaseRealtimeDb, getOrderTrackingPath(orderId)), toWrite);
    return true;
  } catch (error) {
    console.warn('[FirebaseTracking] writeOrderTracking error:', error?.message || error);
    return false;
  }
}
