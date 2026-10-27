import { useEffect, useState } from "react"
import { useProfile } from "@food/context/ProfileContext"
import { useAppLocation } from "@food/hooks/useAppLocation"
import { shouldUseNortheastDemoMenu } from "@food/utils/northeastDemoMenu"

/**
 * True only for customer 7879363299 while the admin's "Northeast Preview" toggle is ON.
 * Used to show that account a full, colourful catalogue (restaurants never greyed out as
 * "offline", demo menus on empty restaurants, demo favorites). Remove together with the
 * toggle when the preview is no longer needed.
 */
const CACHE_TTL_MS = 15 * 1000
let cache = { phone: "", value: false, at: 0, promise: null }

const checkPreview = (userProfile) => {
  const phone = String(userProfile?.phone || userProfile?.mobile || "").replace(/\D/g, "").slice(-10)
  const now = Date.now()
  if (cache.phone === phone && now - cache.at < CACHE_TTL_MS) return Promise.resolve(cache.value)
  if (cache.phone === phone && cache.promise) return cache.promise
  const promise = shouldUseNortheastDemoMenu(userProfile)
    .then((value) => {
      cache = { phone, value, at: Date.now(), promise: null }
      return value
    })
    .catch(() => {
      cache = { phone, value: false, at: Date.now(), promise: null }
      return false
    })
  cache = { ...cache, phone, promise }
  return promise
}

export default function useNortheastPreviewActive() {
  const { userProfile } = useProfile()
  const { zoneId, loading: zoneLoading } = useAppLocation()
  const [active, setActive] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Preview data must never replace a real service zone detected for the user.
    if (zoneLoading || zoneId) {
      setActive(false)
      return () => {
        cancelled = true
      }
    }

    checkPreview(userProfile).then((value) => {
      if (!cancelled) setActive(value)
    })
    return () => {
      cancelled = true
    }
  }, [userProfile?.phone, userProfile?.mobile, zoneId, zoneLoading])

  return active
}

/** Availability object used instead of the real one for the preview account. */
export const PREVIEW_OPEN_STATUS = {
  isOpen: true,
  isActive: true,
  isAcceptingOrders: true,
  isWithinTimings: true,
  reason: "preview",
}
