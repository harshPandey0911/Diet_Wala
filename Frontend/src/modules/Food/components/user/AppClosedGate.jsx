import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { Loader2, Moon, PauseCircle } from "lucide-react"
import { zoneAPI } from "@food/api"
import { readStoredZoneContext } from "@food/utils/locationPersistence"

const POLL_MS = 30 * 1000

const OrderingStatusContext = createContext({ paused: false, message: "" })

/** Browse-only mode: the customer's zone is visible but orders cannot be placed. */
export function useOrderingStatus() {
  return useContext(OrderingStatusContext)
}

// Blocks the whole customer app with a "closed" screen while the admin has the app switched
// off for the customer's zone (or platform-wide), manually or by daily timings. When the zone
// only has ordering paused, the app stays fully usable and a banner explains orders are off.
// Status comes from the server so the clock is IST-correct.
// If settings cannot be loaded the app stays usable.
export default function AppClosedGate({ children }) {
  const [status, setStatus] = useState(null)
  const [ordering, setOrdering] = useState({ paused: false, message: "" })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastZoneRef = useRef(undefined)

  const refresh = useCallback(async () => {
    try {
      // Platform-wide + the customer's zone (zone is persisted by useZone once detected).
      const { zoneId } = readStoredZoneContext()
      lastZoneRef.current = zoneId || null
      const response = await zoneAPI.getAppStatus(zoneId || null)
      const data = response?.data?.data
      setStatus(data?.appStatus || null)
      setOrdering({ paused: data?.ordering?.paused === true, message: data?.ordering?.message || "" })
    } catch {
      // keep the last known status
    }
  }, [])

  // Manual refresh: show a short "checking" state, then reload the page so it feels like a real refresh.
  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    await Promise.all([refresh(), new Promise((resolve) => setTimeout(resolve, 900))])
    window.location.reload()
  }, [isRefreshing, refresh])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    // Re-check right away when the customer's zone gets detected or changes.
    const zoneWatch = setInterval(() => {
      const current = readStoredZoneContext().zoneId || null
      if (current !== lastZoneRef.current) refresh()
    }, 2000)
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", refresh)
    return () => {
      clearInterval(timer)
      clearInterval(zoneWatch)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])

  if (status && status.isOpen === false) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center bg-[#FFFBEB] dark:bg-[#0a0a0a]">
        <div className="w-20 h-20 rounded-full bg-[#FFC700]/20 flex items-center justify-center mb-5">
          <Moon className="w-10 h-10 text-[#D97706]" strokeWidth={2} />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
          {status.title || "App is closed right now"}
        </h1>
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 max-w-xs">
          {status.message}
        </p>
        {status.timingEnabled && status.openingLabel && (
          <p className="mt-4 text-xs font-bold text-[#D97706]">
            Timings: {status.openingLabel} - {status.closingLabel}
          </p>
        )}
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="mt-6 px-5 py-2 rounded-full bg-[#FFC700] text-black text-sm font-extrabold active:scale-95 transition-transform inline-flex items-center gap-2 disabled:opacity-80"
        >
          {isRefreshing && <Loader2 className="w-4 h-4 animate-spin" />}
          {isRefreshing ? "Checking..." : "Refresh"}
        </button>
      </div>
    )
  }

  return (
    <OrderingStatusContext.Provider value={ordering}>
      {ordering.paused && (
        <div
          role="status"
          className="flex items-start gap-2 px-4 py-2.5 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200"
        >
          <PauseCircle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
          <p className="text-xs font-semibold leading-snug">{ordering.message}</p>
        </div>
      )}
      {children}
    </OrderingStatusContext.Provider>
  )
}
