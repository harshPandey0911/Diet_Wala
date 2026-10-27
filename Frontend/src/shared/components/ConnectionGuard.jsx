import { useCallback, useEffect, useRef, useState } from "react"

// Same address the API client uses (see services/api/axios.js).
const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
    : "/api/v1")

const CHECK_TIMEOUT_MS = 12000
const RETRY_MS = 5000

/**
 * Keeps the app from hanging on a logo / skeleton forever when the server cannot be reached.
 * The app renders normally; if a quick health check fails (no network, timeout or a 5xx answer from
 * the server) a clear "can't connect" screen with a Retry button covers it and goes away by itself
 * as soon as the server answers again.
 */
export default function ConnectionGuard({ children }) {
  const [offline, setOffline] = useState(false)
  const [checking, setChecking] = useState(false)
  const timerRef = useRef(null)
  const aliveRef = useRef(true)

  const check = useCallback(async () => {
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
    setChecking(true)
    let reachable = true
    try {
      const response = await fetch(`${API_BASE_URL}/food/build-info`, { cache: "no-store", signal: controller.signal })
      reachable = response.status < 500
    } catch {
      reachable = false
    } finally {
      clearTimeout(abortTimer)
    }
    if (!aliveRef.current) return
    setChecking(false)
    setOffline(!reachable)
    clearTimeout(timerRef.current)
    if (!reachable) timerRef.current = setTimeout(check, RETRY_MS)
  }, [])

  useEffect(() => {
    aliveRef.current = true
    // The public landing page is static and works without the API.
    if (window.location.pathname !== "/") check()
    const onOnline = () => check()
    window.addEventListener("online", onOnline)
    return () => {
      aliveRef.current = false
      clearTimeout(timerRef.current)
      window.removeEventListener("online", onOnline)
    }
  }, [check])

  return (
    <>
      {children}
      {offline ? (
        <div
          role="alert"
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-white px-8 text-center"
        >
          <img src="/logo.png" alt="DietVala" className="w-24 h-24 object-contain mb-6" />
          <h1 className="text-xl font-bold text-gray-900">Can't connect right now</h1>
          <p className="mt-2 max-w-xs text-sm text-gray-600">
            Please check your internet connection. We will keep trying and open the app as soon as we are back online.
          </p>
          <button
            type="button"
            onClick={check}
            disabled={checking}
            className="mt-6 rounded-full bg-[#0B8A3E] px-8 py-3 text-sm font-bold text-white disabled:opacity-70 active:scale-95 transition"
          >
            {checking ? "Trying..." : "Try again"}
          </button>
        </div>
      ) : null}
    </>
  )
}
