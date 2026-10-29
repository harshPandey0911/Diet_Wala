import { useCallback, useEffect, useState } from "react"
import { Moon } from "lucide-react"
import { loadBusinessSettings } from "@food/utils/businessSettings"

const POLL_MS = 60 * 1000

// Blocks the whole customer app with a "closed" screen while the admin has the app switched
// off (manually or by daily timings). Status comes from the server so the clock is IST-correct.
// If settings cannot be loaded the app stays usable.
export default function AppClosedGate({ children }) {
  const [status, setStatus] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const settings = await loadBusinessSettings({ force: true })
      setStatus(settings?.appStatus || null)
    } catch {
      // keep the last known status
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", refresh)
    }
  }, [refresh])

  if (!status || status.isOpen !== false) return children

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
        onClick={refresh}
        className="mt-6 px-5 py-2 rounded-full bg-[#FFC700] text-black text-sm font-extrabold active:scale-95 transition-transform"
      >
        Refresh
      </button>
    </div>
  )
}
