/**
 * Shared memory of restaurant orders that were already answered (accepted / rejected /
 * cancelled / moved on). Everything that can ring for a new order (socket, REST polling,
 * FCM push) checks this first, so an order the restaurant already handled never rings again.
 *
 * Stored in sessionStorage so a page refresh doesn't make old orders ring again.
 */
const STORAGE_KEY = "restaurant_handled_order_ids"
const MAX_AGE_MS = 6 * 60 * 60 * 1000 // forget after 6 hours
const MAX_ENTRIES = 300

let cache = null

const load = () => {
  if (cache) return cache
  cache = new Map()
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null
    const list = raw ? JSON.parse(raw) : []
    const cutoff = Date.now() - MAX_AGE_MS
    for (const [id, at] of Array.isArray(list) ? list : []) {
      if (id && at > cutoff) cache.set(String(id), at)
    }
  } catch {
    // ignore storage problems
  }
  return cache
}

const save = () => {
  try {
    if (typeof sessionStorage === "undefined") return
    const entries = [...load().entries()].slice(-MAX_ENTRIES)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore storage problems
  }
}

/** Every id an order (or push payload) may be known by. */
export const collectOrderIds = (order) => {
  if (order == null) return []
  if (typeof order !== "object") return [String(order).trim()].filter(Boolean)
  const data = order.data && typeof order.data === "object" ? order.data : {}
  return [
    ...new Set(
      [
        order.orderMongoId,
        order.order_mongo_id,
        order.orderId,
        order.order_id,
        order._id,
        order.id,
        data.orderMongoId,
        data.orderId,
        data.order_id,
      ]
        .map((v) => (v == null ? "" : String(v).trim()))
        .filter(Boolean)
    ),
  ]
}

export const markRestaurantOrderHandled = (order) => {
  const ids = collectOrderIds(order)
  if (!ids.length) return ids
  const map = load()
  const now = Date.now()
  ids.forEach((id) => map.set(id, now))
  save()
  return ids
}

/** Undo (e.g. the accept request failed, so the order still needs an answer). */
export const unmarkRestaurantOrderHandled = (order) => {
  const ids = collectOrderIds(order)
  const map = load()
  ids.forEach((id) => map.delete(id))
  save()
}

export const isRestaurantOrderHandled = (order) => {
  const map = load()
  return collectOrderIds(order).some((id) => map.has(id))
}

/** True when two order-like values refer to the same order (any shared id). */
export const isSameOrder = (a, b) => {
  const idsA = collectOrderIds(a)
  if (!idsA.length) return false
  const idsB = new Set(collectOrderIds(b))
  return idsA.some((id) => idsB.has(id))
}
