import { getFirebaseDB } from '../../../../config/firebase.js';
import { logger } from '../../../../utils/logger.js';

const FIREBASE_OFFER_WRITE_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.FIREBASE_OFFER_WRITE_TIMEOUT_MS) || 2500,
);

function sanitizeFirebaseKey(value) {
  return String(value || '').trim().replace(/[.#$/[\]]/g, '_');
}

function getOfferPath(partnerId, orderMongoId) {
  return `delivery_partner_offers/${sanitizeFirebaseKey(partnerId)}/${sanitizeFirebaseKey(orderMongoId)}`;
}

function stripUndefined(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export async function publishDeliveryOfferToFirebase(partnerId, orderMongoId, payload = {}) {
  try {
    const db = getFirebaseDB();
    if (!db || !partnerId || !orderMongoId) return false;

    const offeredAt = Number(payload.offeredAt) || Date.now();
    const writePromise = db.ref(getOfferPath(partnerId, orderMongoId)).set(
      stripUndefined({
        ...payload,
        status: 'offered',
        offeredAt,
        last_updated: Date.now(),
      }),
    )
      .then(() => true)
      .catch((err) => {
        logger.warn(`Firebase delivery offer publish failed: ${err.message}`);
        return false;
      });

    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(false), FIREBASE_OFFER_WRITE_TIMEOUT_MS);
    });

    const published = await Promise.race([writePromise, timeoutPromise]);
    clearTimeout(timeoutId);
    if (!published) {
      logger.warn(
        `Firebase delivery offer unavailable after ${FIREBASE_OFFER_WRITE_TIMEOUT_MS}ms for partner ${partnerId}; continuing with socket/FCM fallback`,
      );
    }
    return published;
  } catch (err) {
    logger.warn(`Firebase delivery offer publish failed: ${err.message}`);
    return false;
  }
}

export async function removeDeliveryOfferFromFirebase(partnerId, orderMongoId) {
  try {
    const db = getFirebaseDB();
    if (!db || !partnerId || !orderMongoId) return false;

    await db.ref(getOfferPath(partnerId, orderMongoId)).remove();
    return true;
  } catch (err) {
    logger.warn(`Firebase delivery offer remove failed: ${err.message}`);
    return false;
  }
}

export async function removeDeliveryOffersForPartners(partnerIds = [], orderMongoId) {
  if (!orderMongoId || !Array.isArray(partnerIds) || partnerIds.length === 0) return;

  await Promise.all(
    partnerIds
      .map((partnerId) => String(partnerId || '').trim())
      .filter(Boolean)
      .map((partnerId) => removeDeliveryOfferFromFirebase(partnerId, orderMongoId)),
  );
}

export async function clearDeliveryOffersForOrder(order, options = {}) {
  const orderMongoId = String(order?._id || order?.orderMongoId || '').trim();
  if (!orderMongoId) return;

  const partnerIds = new Set();
  if (options.includeAssignedPartner && order?.dispatch?.deliveryPartnerId) {
    partnerIds.add(String(order.dispatch.deliveryPartnerId));
  }

  for (const entry of order?.dispatch?.offeredTo || []) {
    if (entry?.partnerId) partnerIds.add(String(entry.partnerId));
  }

  await removeDeliveryOffersForPartners([...partnerIds], orderMongoId);
}
