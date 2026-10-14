import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@food/api/config';
import { isValidSocketOrigin, resolveSocketOrigin } from '@food/utils/socketOrigin';
import { restaurantAPI } from '@food/api';
import alertSound from '@food/assets/audio/alert.mp3';
import {
  RestaurantNotificationContext,
  DEFAULT_RESTAURANT_NOTIFICATIONS,
  useRestaurantNotifications,
  useRestaurantNotificationContext
} from '../context/RestaurantNotificationContextBase';
import { isModuleAuthenticated } from '@food/utils/auth';
import { dispatchNotificationInboxRefresh } from '@food/hooks/useNotificationInbox';
import {
  collectOrderIds,
  isRestaurantOrderHandled,
  isSameOrder,
  markRestaurantOrderHandled,
} from '@food/utils/restaurantOrderAlerts';
const debugLog = (...args) => console.log(...args)
const debugWarn = (...args) => console.warn(...args)
const debugError = (...args) => console.error(...args)

const isProductionBuild = Boolean(import.meta.env.PROD);
const isProductionDeployment =
  typeof window !== 'undefined' &&
  !['localhost', '127.0.0.1'].includes(window.location.hostname);

const resolveAudioSource = (source) => {
  if (!source) return '';
  return typeof source === 'object' ? (source.default || source) : source;
};

// Robust Web Audio API synthesized chime fallback (runs even if MP3 loading or autoplay is restricted)
const playWebAudioChime = () => {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!window._restaurantAudioCtx || window._restaurantAudioCtx.state === 'closed') {
      window._restaurantAudioCtx = new AudioContextClass();
    }
    const ctx = window._restaurantAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [
      { freq: 1046.5, time: now, duration: 0.2 },
      { freq: 1318.5, time: now + 0.22, duration: 0.35 },
      { freq: 1046.5, time: now + 0.6, duration: 0.2 },
      { freq: 1318.5, time: now + 0.82, duration: 0.45 },
    ];

    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.exponentialRampToValueAtTime(0.4, time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + duration);
    });
  } catch (err) {
    debugWarn('Web Audio Chime failed:', err);
  }
};

const supportsBrowserNotifications = () =>
  typeof window !== 'undefined' && typeof Notification !== 'undefined';

const buildRestaurantOrderNotification = (orderData = {}) => {
  const orderId = orderData.orderId || orderData.orderMongoId || 'New';
  const itemCount = Array.isArray(orderData.items) ? orderData.items.length : 0;
  const total = Number(orderData.total || orderData.pricing?.total || 0);

  return {
    title: `New order #${orderId}`,
    body: itemCount > 0
      ? `${itemCount} item${itemCount === 1 ? '' : 's'} - ₹${total.toFixed(2)}`
      : 'A new order is waiting for review',
    tag: `restaurant-order-${orderId}`,
    data: {
      orderId,
      targetUrl: `/restaurant/orders/${orderData.orderMongoId || orderData.orderId || ''}`,
    },
  };
}

const triggerWebViewNativeNotification = async (orderData = {}) => {
  if (typeof window === 'undefined') return false;

  const bridgePayload = {
    title: 'New restaurant order',
    body: `Order #${orderData?.orderId || orderData?.orderMongoId || orderData?.id || ''}`.trim(),
    orderId: orderData?.orderId || orderData?.order_id || '',
    orderMongoId: orderData?.orderMongoId || orderData?.order_mongo_id || '',
    targetUrl: `/restaurant/orders/${orderData?.orderMongoId || orderData?.orderId || ''}`,
  };

  try {
    if (
      window.flutter_inappwebview &&
      typeof window.flutter_inappwebview.callHandler === 'function'
    ) {
      const handlerNames = [
        'playNotificationSound',
        'triggerNotificationFeedback',
        'onPushNotification',
      ];

      for (const handlerName of handlerNames) {
        try {
          await window.flutter_inappwebview.callHandler(handlerName, bridgePayload);
          return true;
        } catch {
          // Try next handler name.
        }
      }
    }
  } catch {
    // Ignore bridge failures and fall back to browser/web audio.
  }

  return false;
}


export {
  DEFAULT_RESTAURANT_NOTIFICATIONS,
  useRestaurantNotifications,
  useRestaurantNotificationContext,
  RestaurantNotificationContext
};

/**
 * Internal hook that creates and manages the actual notification state & socket.
 * Called ONLY once inside RestaurantNotificationProvider.
 */
export const useRestaurantNotificationsState = () => {
  const socketRef = useRef(null);
  const [orderQueue, setOrderQueue] = useState([]); // Queue of pending orders
  const [pickupOtpReveal, setPickupOtpRevealState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('restaurant_pickupOtpReveal');
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }); // { orderId, otp, message }

  const setPickupOtpReveal = (data) => {
    setPickupOtpRevealState(data);
    if (typeof window !== 'undefined') {
      if (data) {
        localStorage.setItem('restaurant_pickupOtpReveal', JSON.stringify(data));
      } else {
        localStorage.removeItem('restaurant_pickupOtpReveal');
      }
    }
  };
  const [isConnected, setIsConnected] = useState(false);
  const audioRef = useRef(null);
  const activeOrderRef = useRef(null);
  const orderQueueRef = useRef([]); // always the latest queue, readable from timers/callbacks
  const alertLoopTimerRef = useRef(null);
  const alertLoopStartedAtRef = useRef(0);
  const userInteractedRef = useRef(false); // Track user interaction for autoplay policy
  const audioUnlockAttemptedRef = useRef(false);
  const [restaurantId, setRestaurantId] = useState(null);
  const lastConnectErrorLogRef = useRef(0);
  const lastAlertAtByOrderRef = useRef(new Map());
  const lastBrowserNotificationAtByOrderRef = useRef(new Map());
  // Track order IDs that have been cancelled so REST polling doesn't resurrect them
  const cancelledOrderIdsRef = useRef(new Set());
  const CONNECT_ERROR_LOG_THROTTLE_MS = 10000;
  const ALERT_LOOP_INTERVAL_MS = 4500;
  const ALERT_LOOP_MAX_MS = 120000;
  const ALERT_DEDUPE_MS = 15000;
  const BROWSER_NOTIFICATION_DEDUPE_MS = 20000;
  const NOTIFICATION_PERMISSION_ASKED_KEY = 'restaurant_notification_permission_asked';

  const getOrderAlertKey = (orderData = {}) => (
    String(
      orderData?.orderMongoId ||
      orderData?.order_mongo_id ||
      orderData?.orderId ||
      orderData?.order_id ||
      orderData?._id ||
      orderData?.id ||
      ''
    ).trim()
  );

  // Keep the ref in step with state.
  useEffect(() => {
    orderQueueRef.current = orderQueue;
  }, [orderQueue]);

  // Enqueue a new order into the queue (deduplicates by ID).
  // An order that was already accepted/rejected/cancelled is never queued again.
  const enqueueOrder = (orderData) => {
    if (isRestaurantOrderHandled(orderData)) return;
    setOrderQueue(prev => {
      if (prev.some(o => isSameOrder(o, orderData))) return prev;
      const next = [...prev, orderData];
      orderQueueRef.current = next;
      return next;
    });
  };

  // Remove the first order from the queue
  const dequeueOrder = () => {
    setOrderQueue(prev => prev.slice(1));
  };

  const shouldProcessOrderAlert = (orderData = {}) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastAlertAtByOrderRef.current.get(key) || 0;
    if (now - last < ALERT_DEDUPE_MS) return false;
    lastAlertAtByOrderRef.current.set(key, now);
    return true;
  };

  const shouldShowBrowserNotification = (orderData = {}) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastBrowserNotificationAtByOrderRef.current.get(key) || 0;
    if (now - last < BROWSER_NOTIFICATION_DEDUPE_MS) return false;
    lastBrowserNotificationAtByOrderRef.current.set(key, now);
    return true;
  };

  const showBackgroundOrderNotification = async (orderData) => {
    if (!shouldShowBrowserNotification(orderData)) {
      return;
    }

    if (!supportsBrowserNotifications() || Notification.permission !== 'granted') {
      return;
    }

    const notificationOptions = buildRestaurantOrderNotification(orderData);

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(notificationOptions.title, {
            body: notificationOptions.body,
            tag: notificationOptions.tag,
            renotify: true,
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200, 100, 300],
            icon: '/logo.png?v=2',
            data: notificationOptions.data,
          });
          return;
        }
      }

      new Notification(notificationOptions.title, {
        body: notificationOptions.body,
        tag: notificationOptions.tag,
        requireInteraction: true,
        silent: false,
        icon: '/logo.png',
        data: notificationOptions.data,
      });
    } catch (error) {
      debugWarn('Error showing background restaurant notification:', error);
    }
  };

  const stopAlertLoop = () => {
    if (alertLoopTimerRef.current) {
      clearInterval(alertLoopTimerRef.current);
      alertLoopTimerRef.current = null;
    }
    alertLoopStartedAtRef.current = 0;
  };

  // Ring for `order` now and keep ringing until it is answered (or the max time passes).
  const startRingingFor = (order) => {
    activeOrderRef.current = order;
    playNotificationSound(order);
    startAlertLoop();
  };

  /**
   * An order has been answered (accepted / rejected / cancelled / moved past "new").
   * Removes it from the queue, remembers it so no source can ring for it again, and
   * stops the ring. If another order is still waiting, the ring continues for that one
   * instead of going silent.
   */
  const removeOrderFromQueue = useCallback((orderLike, { markHandled = true } = {}) => {
    if (orderLike == null || orderLike === '') return;
    // markHandled=false: just take it out of the queue for now (e.g. a scheduled order that
    // is still far away) but let it ring later when it becomes due.
    if (markHandled) markRestaurantOrderHandled(orderLike);
    const wasActive = activeOrderRef.current && isSameOrder(activeOrderRef.current, orderLike);

    const remaining = orderQueueRef.current.filter((o) => !isSameOrder(o, orderLike));
    orderQueueRef.current = remaining;
    setOrderQueue(remaining);

    if (wasActive) {
      stopAlertLoop();
      activeOrderRef.current = null;
      if (remaining.length > 0) {
        startRingingFor(remaining[0]);
      }
    }
  }, []);

  const startAlertLoop = () => {
    stopAlertLoop();
    alertLoopStartedAtRef.current = Date.now();

    alertLoopTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - alertLoopStartedAtRef.current;
      if (elapsed >= ALERT_LOOP_MAX_MS || !activeOrderRef.current) {
        stopAlertLoop();
        return;
      }

      // Safety net: never ring for an order that has already been answered.
      if (isRestaurantOrderHandled(activeOrderRef.current)) {
        removeOrderFromQueue(activeOrderRef.current);
        return;
      }

      if (typeof document !== 'undefined') {
        playNotificationSound(activeOrderRef.current);
      }
    }, ALERT_LOOP_INTERVAL_MS);
  };

  const handleIncomingOrderAlert = (orderData, source = 'unknown') => {
    const isSocket = source === 'socket';

    // Already accepted / rejected / cancelled: never ring again (a stale poll or a late push
    // can still carry the old "new order" state).
    if (isRestaurantOrderHandled(orderData)) {
      return;
    }
    
    // For scheduled orders, don't alert at all if they are far away (more than 15 mins)
    if (orderData?.scheduledAt) {
      const scheduledTime = new Date(orderData.scheduledAt).getTime();
      const now = Date.now();
      const isDueSoon = scheduledTime <= now + 15 * 60000;
      
      // If not due soon, ignore this order for sound/alerts
      if (!isDueSoon) {
        return;
      }
    }

    const deduped = !shouldProcessOrderAlert(orderData);
    
    // If it's a poll and it was already alerted recently, skip.
    // If it's a socket event, we always process it (e.g., manual 'Resend' triggers).
    if (deduped && !isSocket) {
      return;
    }

    // If another order is already ringing, keep that ring going (it stays first in the queue);
    // the new one rings immediately once, and takes over when the first is answered.
    if (!activeOrderRef.current || isSameOrder(activeOrderRef.current, orderData)) {
      activeOrderRef.current = orderData || { id: Date.now() };
    }

    const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    
    // Always play sound immediately
    playNotificationSound(orderData);

    startAlertLoop();

    if (isTabHidden) {
      showBackgroundOrderNotification(orderData);
    }
  };

  // Orders still waiting for the restaurant have UI status "confirmed" (backend "created").
  // If a queued/ringing order shows any other status on the server, it was already answered.
  const syncQueueWithServerRows = (rows = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const candidates = [
      ...(activeOrderRef.current ? [activeOrderRef.current] : []),
      ...orderQueueRef.current,
    ];
    for (const queued of candidates) {
      const serverRow = rows.find((row) => isSameOrder(row, queued));
      if (!serverRow) continue;
      const status = String(serverRow?.status || serverRow?.orderStatus || '').toLowerCase().trim().replace(/\s+/g, '_');
      if (status && status !== 'confirmed' && status !== 'created') {
        removeOrderFromQueue(serverRow);
      }
    }
  };

  // Get restaurant ID from API (restaurant session only)
  useEffect(() => {
    if (!isModuleAuthenticated('restaurant')) return;

    const fetchRestaurantId = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        if (response.data?.success && response.data.data?.restaurant) {
          const restaurant = response.data.data.restaurant;
          const id = restaurant._id?.toString() || restaurant.restaurantId;
          setRestaurantId(id);
        }
      } catch (error) {
        debugError('Error fetching restaurant:', error);
      }
    };
    fetchRestaurantId();
  }, []);

  // Reliability fallback:
  // If Socket.IO fails (expired jwt / missing token / room join failed),
  // we still fetch restaurant orders from REST periodically and trigger the same
  // alert flow. This prevents "restaurant didn't receive the order" cases.
  useEffect(() => {
    if (!restaurantId) return;

    const ALERT_POLL_MS = 8000;
    let isCancelled = false;

    const pollOrders = async () => {
      if (isCancelled) return;

      try {
        const response = await restaurantAPI.getOrders({ page: 1, limit: 30 });
        const rows =
          response?.data?.data?.orders ||
          response?.data?.data?.data?.orders ||
          [];

        // REST layer normalizes backend statuses so:
        // - backend "created" -> UI "confirmed"
        // We alert only for "confirmed/new order waiting for review".
        const confirmed = (rows || [])
          .filter((o) => {
            const status = String(o?.status || "").toLowerCase();
            if (status !== "confirmed") return false;

            // Skip orders that have been locally marked as cancelled
            const oId = String(o?._id || o?.orderMongoId || o?.orderId || '').trim();
            if (oId && cancelledOrderIdsRef.current.has(oId)) return false;
            if (isRestaurantOrderHandled(o)) return false;

            // If it's a scheduled order, only alert if it's due soon (within 30 mins)
            if (o.scheduledAt) {
              const scheduledTime = new Date(o.scheduledAt).getTime();
              const now = Date.now();
              return scheduledTime <= now + 30 * 60000;
            }

            // Only alert for recent confirmed orders (created within the last 15 minutes)
            // This prevents old historical orders from filling the queue and blocking new incoming orders
            const createdAtTime = new Date(o?.createdAt || o?.updatedAt || 0).getTime();
            const isRecent = Date.now() - createdAtTime <= 15 * 60 * 1000;
            return isRecent;
          })
          .sort((a, b) => {
            const at = a?.updatedAt || a?.createdAt || 0;
            const bt = b?.updatedAt || b?.createdAt || 0;
            return new Date(bt).getTime() - new Date(at).getTime();
          });

        // Server is the truth: any order we are ringing/queueing that is no longer "new"
        // (accepted from another device, auto-rejected, cancelled, ...) must stop ringing.
        syncQueueWithServerRows(rows);

        if (confirmed.length > 0) {
          // Trigger alerts for newest confirmed orders (dedupe prevents spam).
          confirmed.slice(0, 5).forEach((o) => {
            handleIncomingOrderAlert(o, 'poll');
            enqueueOrder(o); // add each confirmed order to the queue
          });
        }

        // --- NEW: Fallback for Cancellations if Socket failed ---
        if (activeOrderRef.current) {
          const activeId = activeOrderRef.current._id || activeOrderRef.current.orderMongoId || activeOrderRef.current.orderId;
          const matchingOrderInPoll = rows.find(o => o._id === activeId || o.orderId === activeId);
          if (matchingOrderInPoll) {
            const statusRaw = String(matchingOrderInPoll.status || matchingOrderInPoll.orderStatus || '').toLowerCase().trim().replace(/\s+/g, '_');
            if (statusRaw === 'cancelled_by_user' || statusRaw === 'cancelled_by_restaurant' || statusRaw === 'cancelled_by_admin' || statusRaw === 'cancelled') {
              debugLog('?? Fallback: Active order cancelled detected via REST poll:', matchingOrderInPoll);
              removeOrderFromQueue(activeId);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('restaurantOrderStatusUpdate', {
                    detail: matchingOrderInPoll,
                  }),
                );
              }
            }
          }
        }

        // --- NEW: Fallback for Pickup OTP Request if Socket failed ---
        const currentOtpRevealStr = typeof window !== 'undefined' ? localStorage.getItem('restaurant_pickupOtpReveal') : null;
        let currentOtpRevealObj = null;
        if (currentOtpRevealStr) {
           try { currentOtpRevealObj = JSON.parse(currentOtpRevealStr); } catch(e) {}
        }

        const otpRequests = rows.filter(o => {
          const reqAt = o?.deliveryVerification?.pickupOtp?.requestedAt;
          const isVerified = o?.deliveryVerification?.pickupOtp?.verified;
          const pickupOtp = o?.pickupOtp;
          
          if (!reqAt || isVerified || !pickupOtp) return false;
          
          // Only show if requested within last 15 minutes
          const requestedTime = new Date(reqAt).getTime();
          const now = Date.now();
          if (now - requestedTime > 15 * 60000) return false;
          
          // Don't show if we are already showing it
          if (currentOtpRevealObj && currentOtpRevealObj.orderMongoId === o._id) return false;
          
          return true;
        }).sort((a, b) => new Date(b.deliveryVerification.pickupOtp.requestedAt).getTime() - new Date(a.deliveryVerification.pickupOtp.requestedAt).getTime());

        if (otpRequests.length > 0) {
           const latestReq = otpRequests[0];
           const payload = {
              orderMongoId: latestReq._id.toString(),
              orderId: latestReq.orderId || latestReq.order_id || latestReq._id.toString(),
              otp: latestReq.pickupOtp,
              message: 'Delivery partner is requesting the Pickup OTP. Please share this code with them.'
           };
           setPickupOtpReveal(payload);
        }
        // -------------------------------------------------------------
      } catch (error) {
        // Non-blocking: keep polling.
      }
    };

    // Initial poll immediately.
    pollOrders();
    const intervalId = setInterval(pollOrders, ALERT_POLL_MS);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!supportsBrowserNotifications()) return;

    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY) === 'true') return;

    const requestPermissionOnce = async () => {
      localStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      try {
        await Notification.requestPermission();
      } catch (error) {
        debugWarn('Failed to request restaurant notification permission:', error);
      }
    };

    const askOnInteraction = () => {
      requestPermissionOnce();
      window.removeEventListener('pointerdown', askOnInteraction);
      window.removeEventListener('keydown', askOnInteraction);
    };

    window.addEventListener('pointerdown', askOnInteraction, { once: true, passive: true });
    window.addEventListener('keydown', askOnInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', askOnInteraction);
      window.removeEventListener('keydown', askOnInteraction);
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      
      if (document.visibilityState === 'visible') {
        // Force a REST fetch on foreground to catch any orders missed while in background
        if (restaurantId) {
          restaurantAPI.getOrders({ page: 1, limit: 10 }).then(response => {
             const rows = response?.data?.data?.orders || response?.data?.data?.data?.orders || [];
             const confirmed = (rows || []).filter(o => {
                const status = String(o?.status || "").toLowerCase();
                if (status !== "confirmed") return false;
                // Skip orders that have been locally marked as cancelled
                const oId = String(o?._id || o?.orderMongoId || o?.orderId || '').trim();
                if (oId && cancelledOrderIdsRef.current.has(oId)) return false;
                if (isRestaurantOrderHandled(o)) return false;
                if (o.scheduledAt) {
                  return new Date(o.scheduledAt).getTime() <= Date.now() + 30 * 60000;
                }
                const createdAtTime = new Date(o?.createdAt || o?.updatedAt || 0).getTime();
                return Date.now() - createdAtTime <= 15 * 60 * 1000;
             }).sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
             
             syncQueueWithServerRows(rows);

             if (confirmed.length > 0) {
                confirmed.slice(0, 5).forEach(o => enqueueOrder(o));
             }

             // --- NEW: Fallback for Cancellations if Socket failed ---
             if (activeOrderRef.current) {
                const activeId = activeOrderRef.current._id || activeOrderRef.current.orderMongoId || activeOrderRef.current.orderId;
                const matchingOrderInPoll = rows.find(o => o._id === activeId || o.orderId === activeId);
                if (matchingOrderInPoll) {
                  const statusRaw = String(matchingOrderInPoll.status || matchingOrderInPoll.orderStatus || '').toLowerCase().trim().replace(/\s+/g, '_');
                  if (statusRaw === 'cancelled_by_user' || statusRaw === 'cancelled_by_restaurant' || statusRaw === 'cancelled_by_admin' || statusRaw === 'cancelled') {
                    debugLog('?? Fallback: Active order cancelled detected via REST poll on visibility change:', matchingOrderInPoll);
                    removeOrderFromQueue(activeId);
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent('restaurantOrderStatusUpdate', {
                          detail: matchingOrderInPoll,
                        }),
                      );
                    }
                  }
                }
             }
          }).catch(() => {});
        }
      } else if (document.visibilityState === 'hidden' && activeOrderRef.current) {
        // Trigger one-shot alert when tab is hidden to ensure user didn't miss it
        playNotificationSound(activeOrderRef.current);
        showBackgroundOrderNotification(activeOrderRef.current);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!API_BASE_URL || !String(API_BASE_URL).trim()) {
      setIsConnected(false);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = false;
      return;
    }
    if (!restaurantId) {
      debugLog('? Waiting for restaurantId...');
      return;
    }

    // Normalize backend URL - use simpler, more robust approach
    let backendUrl = API_BASE_URL;
    
    // Step 1: Extract protocol and hostname using URL parsing if possible
    try {
      const urlObj = new URL(backendUrl);
      // Remove /api from pathname
      let pathname = urlObj.pathname.replace(/^\/api\/?$/, '');
      // Reconstruct clean URL
      backendUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}${pathname}`;
    } catch (e) {
      // If URL parsing fails, use regex-based normalization
      // Remove /api suffix first
      backendUrl = backendUrl.replace(/\/api\/?$/, '');
      backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes
      
      // Normalize protocol - ensure exactly two slashes after protocol
      // Fix patterns: https:/, https:///, https://https://
      if (backendUrl.startsWith('https:') || backendUrl.startsWith('http:')) {
        // Extract protocol
        const protocolMatch = backendUrl.match(/^(https?):/i);
        if (protocolMatch) {
          const protocol = protocolMatch[1].toLowerCase();
          // Remove everything up to and including the first valid domain part
          const afterProtocol = backendUrl.substring(protocol.length + 1);
          // Remove leading slashes
          const cleanPath = afterProtocol.replace(/^\/+/, '');
          // Reconstruct with exactly two slashes
          backendUrl = `${protocol}://${cleanPath}`;
        }
      }
    }
    
    // Final cleanup: ensure exactly two slashes after protocol
    backendUrl = backendUrl.replace(/^(https?):\/+/gi, '$1://');
    backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes
    

    
    // Validate backend URL format
    if (!backendUrl || !backendUrl.startsWith('http')) {
      debugError('? CRITICAL: Invalid backend URL format:', backendUrl);
      debugError('?? API_BASE_URL:', API_BASE_URL);
      debugError('?? Expected format: https://your-domain.com or ');
      setIsConnected(false);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = false;
      return; // Don't try to connect with invalid URL
    }
    
    // Backend uses a dedicated Socket.IO server; resolve shared socket origin.
    const socketUrl = resolveSocketOrigin();

    if (!isValidSocketOrigin(socketUrl)) {
      debugError('? CRITICAL: Invalid Socket.IO origin resolved for restaurant:', socketUrl);
      debugError('?? API_BASE_URL:', API_BASE_URL);
      setIsConnected(false);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = false;
      return;
    }
    
    // Validate socket URL format
    try {
      const urlTest = new URL(socketUrl); // This will throw if URL is invalid
      // Additional validation: ensure it's not localhost in production
      if ((isProductionBuild || isProductionDeployment) && (urlTest.hostname === 'localhost' || urlTest.hostname === '127.0.0.1')) {
        debugError('? CRITICAL: Socket URL contains localhost in production!');
        debugError('?? Socket URL:', socketUrl);
        debugError('?? This should have been caught earlier, but blocking anyway');
        setIsConnected(false);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = false;
        return;
      }
    } catch (urlError) {
      debugError('? CRITICAL: Invalid Socket.IO URL:', socketUrl);
      debugError('?? URL validation error:', urlError.message);
      debugError('?? Backend URL:', backendUrl);
      debugError('?? API_BASE_URL:', API_BASE_URL);
      setIsConnected(false);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = false;
      return; // Don't try to connect with invalid URL
    }
    
    debugLog('?? Attempting to connect to Socket.IO:', socketUrl);
    debugLog('?? Backend URL:', backendUrl);
    debugLog('?? API_BASE_URL:', API_BASE_URL);
    debugLog('?? Restaurant ID:', restaurantId);
    debugLog('?? Environment:', import.meta.env.MODE);
    debugLog('?? Is Production Build:', isProductionBuild);
    debugLog('?? Is Production Deployment:', isProductionDeployment);

    const restaurantToken =
      localStorage.getItem('restaurant_accessToken') || localStorage.getItem('accessToken');

    if (!restaurantToken) {
      setIsConnected(false);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = false;
      return;
    }

    // Initialize socket connection (default namespace)
    // WebSocket-first for instant delivery; polling is the automatic fallback.
    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      auth: {
        token: restaurantToken,
      },
      query: { token: restaurantToken },
    });

    socketRef.current.on('connect', () => {
      debugLog('? Restaurant Socket connected, restaurantId:', restaurantId);
      debugLog('? Socket ID:', socketRef.current.id);
      debugLog('? Socket URL:', socketUrl);
      setIsConnected(true);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = true;
      
      // Join restaurant room immediately after connection with retry
      if (restaurantId) {
        const joinRoom = () => {
          debugLog('?? Joining restaurant room with ID:', restaurantId);
          socketRef.current.emit('join-restaurant', restaurantId);
          
          // Retry join after 2 seconds if no confirmation received
          setTimeout(() => {
            if (socketRef.current?.connected) {
              debugLog('?? Retrying restaurant room join...');
              socketRef.current.emit('join-restaurant', restaurantId);
            }
          }, 2000);
        };
        
        joinRoom();
      } else {
        debugWarn('?? Cannot join restaurant room: restaurantId is missing');
      }
    });

    // Listen for room join confirmation
    socketRef.current.on('restaurant-room-joined', (data) => {
      debugLog('? Restaurant room joined successfully:', data);
      debugLog('? Room:', data?.room);
      debugLog('? Restaurant ID in room:', data?.restaurantId);
    });

    // Listen for connection errors (throttle logs to avoid console spam on reconnect loops)
    socketRef.current.on('connect_error', (error) => {
      const now = Date.now();
      const shouldLog = now - lastConnectErrorLogRef.current >= CONNECT_ERROR_LOG_THROTTLE_MS;
      if (shouldLog) {
        lastConnectErrorLogRef.current = now;
        const isTransportError = error.type === 'TransportError' || error.message?.includes('xhr poll error');
        debugWarn(
          'Restaurant Socket:',
          isTransportError
            ? `Cannot reach backend at ${backendUrl}. Ensure the backend is running (e.g. npm run dev in backend).`
            : error.message
        );
        if (!isTransportError) {
          debugWarn('Details:', { type: error.type, socketUrl, backendUrl });
        }
      }
      if (error.message?.includes('CORS') || error.message?.includes('Not allowed')) {
        debugWarn('?? Add frontend URL to CORS_ORIGIN in backend .env');
      }
      setIsConnected(false);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = false;
    });

    // Listen for disconnection
    socketRef.current.on('disconnect', (reason) => {
      debugLog('? Restaurant Socket disconnected:', reason);
      setIsConnected(false);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, reconnect manually
        socketRef.current.connect();
      }
    });

    // Listen for reconnection attempts
    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      debugLog(`?? Reconnection attempt ${attemptNumber}...`);
    });

    // Listen for successful reconnection
    socketRef.current.on('reconnect', (attemptNumber) => {
      debugLog(`? Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      if (typeof window !== 'undefined') window.restaurantSocketConnected = true;
      
      // Rejoin restaurant room after reconnection
      if (restaurantId) {
        socketRef.current.emit('join-restaurant', restaurantId);
      }
    });

    // Listen for new order notifications
    socketRef.current.on('new_order', (orderData) => {
      const normalizedOrder = {
        ...orderData,
        orderMongoId: orderData?.orderMongoId || orderData?._id || orderData?.order_mongo_id,
        orderId: orderData?.orderId || orderData?.order_id || orderData?._id,
      };

      // Filter scheduled orders here as well to prevent "red dot" from showing up too early
      if (normalizedOrder.scheduledAt) {
        const scheduledTime = new Date(normalizedOrder.scheduledAt).getTime();
        const now = Date.now();
        if (scheduledTime > now + 15 * 60000) {
          debugLog('Ignoring far-away scheduled order from socket:', normalizedOrder.orderId);
          return;
        }
      }

      debugLog('?? New order received:', normalizedOrder);
      enqueueOrder(normalizedOrder); // add to queue

      handleIncomingOrderAlert(normalizedOrder, 'socket');
    });
    
    // Listen for sound notification event
    socketRef.current.on('play_notification_sound', (data) => {
      debugLog('?? Sound notification:', data);
      const normalizedData = {
        orderId: data?.orderId || data?.order_id,
        orderMongoId: data?.orderMongoId || data?.order_mongo_id,
        ...data
      };
      // handleIncomingOrderAlert manages sound (socket source always rings) and background notifications
      handleIncomingOrderAlert(normalizedData, 'socket');
    });

    // Listen for order status updates
    socketRef.current.on('order_status_update', (data) => {
      debugLog('?? Order status update:', data);

      // Track cancelled order IDs so REST polling never resurrects them
      const statusRaw = String(data?.orderStatus || data?.status || '').toLowerCase().trim().replace(/\s+/g, '_');

      // Accepted / preparing / ready / delivered ...: this order is no longer "new", stop ringing for it.
      if (statusRaw && statusRaw !== 'confirmed' && statusRaw !== 'created') {
        removeOrderFromQueue(data);
      }
      if (statusRaw === 'cancelled_by_user' || statusRaw === 'cancelled_by_restaurant' || statusRaw === 'cancelled_by_admin' || statusRaw === 'cancelled') {
        const ids = [data?.orderMongoId, data?.orderId, data?._id, data?.id]
          .map(v => v == null ? '' : String(v).trim())
          .filter(Boolean);
        for (const id of ids) {
          cancelledOrderIdsRef.current.add(id);
          removeOrderFromQueue(id);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('restaurantOrderStatusUpdate', {
            detail: data || {},
          }),
        );
      }
    });

    // Listen for pickup OTP reveal (rider pressed "Request OTP" button)
    socketRef.current.on('pickup_otp_reveal', (data) => {
      debugLog('?? Pickup OTP reveal received:', data);
      setPickupOtpReveal(data);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('restaurantPickupOtpReveal', { detail: data || {} })
        );
      }
    });

    socketRef.current.on('admin_notification', (payload) => {
      debugLog('?? Admin broadcast received:', payload);
      dispatchNotificationInboxRefresh();
    });

    // Load notification sound cleanup on restaurantId change
    return () => {
      stopAlertLoop();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [restaurantId]);

  // Initialize notification sound audio element immediately on mount
  useEffect(() => {
    try {
      const audio = new Audio(resolveAudioSource(alertSound));
      audio.preload = 'auto';
      audio.volume = 1;
      audioRef.current = audio;
    } catch (e) {
      debugWarn('Failed to create notification audio element:', e);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Prime audio & Web Audio API gesture on user interaction
  useEffect(() => {
    let unlocked = false;

    const handleUserInteraction = async () => {
      if (unlocked) return;
      userInteractedRef.current = true;
      audioUnlockAttemptedRef.current = true;

      // Unlock HTMLAudioElement
      if (audioRef.current) {
        try {
          const wasMuted = audioRef.current.muted;
          audioRef.current.muted = true;
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.muted = wasMuted;
          unlocked = true;
        } catch (err) {
          debugWarn('Audio element unlock attempt failed:', err);
        }
      }

      // Unlock Web Audio Context
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          if (!window._restaurantAudioCtx || window._restaurantAudioCtx.state === 'closed') {
            window._restaurantAudioCtx = new AudioContextClass();
          }
          if (window._restaurantAudioCtx.state === 'suspended') {
            await window._restaurantAudioCtx.resume();
          }
          unlocked = true;
        }
      } catch (err) {
        debugWarn('AudioContext unlock attempt failed:', err);
      }

      if (unlocked) {
        ['click', 'touchstart', 'keydown', 'pointerdown'].forEach((evt) => {
          document.removeEventListener(evt, handleUserInteraction);
          window.removeEventListener(evt, handleUserInteraction);
        });
      }
    };

    ['click', 'touchstart', 'keydown', 'pointerdown'].forEach((evt) => {
      document.addEventListener(evt, handleUserInteraction, { passive: true });
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    return () => {
      ['click', 'touchstart', 'keydown', 'pointerdown'].forEach((evt) => {
        document.removeEventListener(evt, handleUserInteraction);
        window.removeEventListener(evt, handleUserInteraction);
      });
    };
  }, []);

  const playNotificationSound = async (orderData = {}) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          if (!navigator.userActivation || navigator.userActivation.hasBeenActive) {
            navigator.vibrate([200, 100, 200, 100, 300]);
          }
        } catch (e) {
          // Ignore vibration errors
        }
      }

      let playedSuccessfully = false;
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.currentTime = 0;
        try {
          await audioRef.current.play();
          playedSuccessfully = true;
        } catch (error) {
          debugWarn('HTMLAudioElement play failed, trying fallback:', error);
        }
      }

      if (!playedSuccessfully) {
        // Fallback: Web Audio synthesizer chime
        playWebAudioChime();
      }
    } catch (error) {
      debugWarn('Error playing sound, using chime fallback:', error);
      playWebAudioChime();
    }
  };

  /**
   * Call when the restaurant has answered an order (accept / reject / dismiss).
   * Pass the order that was answered. Without it, the order currently at the head of the
   * queue is treated as answered.
   */
  const clearNewOrder = (answeredOrder, options) => {
    const target = answeredOrder || orderQueueRef.current[0] || activeOrderRef.current;
    if (!target) {
      stopAlertLoop();
      activeOrderRef.current = null;
      return;
    }
    removeOrderFromQueue(target, options);
  };

  // Expose the head of queue as `newOrder` for backward compatibility
  const newOrder = orderQueue[0] || null;

  return {
    newOrder,
    orderQueue,
    pickupOtpReveal,
    clearPickupOtpReveal: () => setPickupOtpReveal(null),
    clearNewOrder,
    isConnected,
    playNotificationSound,
    stopAlertLoop,
    removeOrderFromQueue,
  };
};



