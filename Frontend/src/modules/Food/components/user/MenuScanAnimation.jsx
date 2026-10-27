import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RestaurantDetailSkeleton } from "@food/components/ui/loading-skeletons"

const FADE_MS = 300

/**
 * Full-screen skeleton shown while a page loads.
 * - `duration`: the longest it stays (ms).
 * - `ready` (optional): when it becomes true the overlay fades out right away, so it never covers a page
 *   whose data has already arrived. Leave it undefined to always wait the full `duration`.
 */
export default function MenuScanAnimation({ onComplete, duration = 3000, ready }) {
  const [visible, setVisible] = useState(true)
  // The parent usually passes a new arrow function on every render; keep the latest one in a ref so
  // re-renders do not restart the timers (that kept the overlay up longer than `duration`).
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const finishedRef = useRef(false)

  const finish = (delay) => {
    if (finishedRef.current) return
    finishedRef.current = true
    setVisible(false)
    setTimeout(() => onCompleteRef.current?.(), delay)
  }

  useEffect(() => {
    const timer = setTimeout(() => finish(FADE_MS), Math.max(0, duration - FADE_MS))
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  useEffect(() => {
    if (ready) finish(FADE_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS / 1000 }}
          className="fixed inset-0 z-[9999] bg-white overflow-hidden"
        >
          <RestaurantDetailSkeleton />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
