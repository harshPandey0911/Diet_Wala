import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Phone,
  MessageSquare,
  CheckCircle,
  XCircle,
  LogIn,
  CheckCircle2,
  Loader2,
  UtensilsCrossed,
  RefreshCw,
} from "lucide-react"
import { diningAPI } from "@food/api"
import { useAuthStore } from "@/core/auth/auth.store"
import { toast } from "sonner"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"

const STATUS_TRANSITIONS = {
  pending:      [{ status: "accepted",   label: "Accept",   icon: CheckCircle,  color: "text-green-600 border-green-200 bg-green-50 hover:bg-green-100" },
                 { status: "cancelled",  label: "Reject",   icon: XCircle,      color: "text-red-500 border-red-200 bg-red-50 hover:bg-red-100" }],
  accepted:     [{ status: "checked-in", label: "Check-in", icon: LogIn,        color: "text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100" },
                 { status: "cancelled",  label: "Cancel",   icon: XCircle,      color: "text-red-500 border-red-200 bg-red-50 hover:bg-red-100" }],
  "checked-in": [{ status: "completed",  label: "Complete", icon: CheckCircle2, color: "text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100" }],
  completed:    [],
  cancelled:    [],
}

const STATUS_BADGE = {
  pending:      "bg-amber-100 text-amber-700",
  accepted:     "bg-green-100 text-green-700",
  "checked-in": "bg-blue-100 text-blue-700",
  completed:    "bg-purple-100 text-purple-700",
  cancelled:    "bg-red-100 text-red-700",
}

const STATUS_LABEL = {
  pending:      "Pending",
  accepted:     "Accepted",
  "checked-in": "Checked-in",
  completed:    "Completed",
  cancelled:    "Cancelled",
}

const DATE_FILTERS = [
  { key: "today",    label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week",     label: "This Week" },
  { key: "all",      label: "All" },
]

function isDateInFilter(bookingDate, filter) {
  const d = new Date(bookingDate)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (filter === "today") {
    const end = new Date(todayStart.getTime() + 86400000)
    return d >= todayStart && d < end
  }
  if (filter === "tomorrow") {
    const start = new Date(todayStart.getTime() + 86400000)
    const end   = new Date(todayStart.getTime() + 2 * 86400000)
    return d >= start && d < end
  }
  if (filter === "week") {
    const end = new Date(todayStart.getTime() + 7 * 86400000)
    return d >= todayStart && d < end
  }
  return true
}

export default function DiningReservations() {
  const goBack     = useRestaurantBackNavigation()
  const restaurant = useAuthStore((s) => s.user)

  const [bookings,     setBookings]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const [activeFilter, setActiveFilter] = useState("today")
  const [error,        setError]        = useState(null)

  const fetchBookings = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else         setRefreshing(true)
      const response = await diningAPI.getRestaurantBookings(restaurant)
      if (response.data.success) {
        setBookings(Array.isArray(response.data.data) ? response.data.data : [])
        setError(null)
      }
    } catch {
      setError("Failed to load bookings. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [restaurant])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      setProcessingId(bookingId)
      const response = await diningAPI.updateBookingStatusRestaurant(bookingId, newStatus)
      if (response.data.success) {
        setBookings((prev) =>
          prev.map((b) => b._id === bookingId ? { ...b, status: newStatus } : b)
        )
        const messages = {
          accepted:     "Booking accepted! Customer notified.",
          cancelled:    "Booking rejected.",
          "checked-in": "Customer checked in!",
          completed:    "Booking marked as completed.",
        }
        toast.success(messages[newStatus] || "Status updated.")
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update booking status.")
    } finally {
      setProcessingId(null)
    }
  }

  const filtered = bookings.filter((b) => isDateInFilter(b.date, activeFilter))

  const pendingCounts = DATE_FILTERS.reduce((acc, f) => {
    acc[f.key] = bookings.filter(
      (b) => isDateInFilter(b.date, f.key) && b.status === "pending"
    ).length
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">Dining Reservations</h1>
            <p className="text-xs text-slate-500">Manage table bookings</p>
          </div>
          <button
            onClick={() => fetchBookings(true)}
            disabled={refreshing}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-none">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`relative flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                activeFilter === f.key
                  ? "bg-[#7e3866] text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {f.label}
              {pendingCounts[f.key] > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  activeFilter === f.key
                    ? "bg-white/30 text-white"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {pendingCounts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-[#7e3866] animate-spin" />
            <p className="text-sm text-slate-500">Loading bookings...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-16">
            <p className="text-red-500 text-sm font-medium mb-3">{error}</p>
            <button
              onClick={() => fetchBookings()}
              className="px-4 py-2 bg-[#7e3866] text-white text-sm font-bold rounded-xl"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-700">No bookings</h3>
            <p className="text-sm text-slate-400 mt-1">
              No reservations found for this period.
            </p>
          </div>
        )}

        {/* Booking Cards */}
        {!loading && !error && filtered.map((booking) => {
          const actions     = STATUS_TRANSITIONS[booking.status] || []
          const isProcessing = processingId === booking._id

          return (
            <div
              key={booking._id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                <div>
                  <p className="font-bold text-slate-900 text-sm">
                    {booking.user?.name || "Guest"}
                  </p>
                  {booking.user?.phone && (
                    <a
                      href={`tel:${booking.user.phone}`}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#7e3866] mt-0.5 transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {booking.user.phone}
                    </a>
                  )}
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    STATUS_BADGE[booking.status] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {STATUS_LABEL[booking.status] || booking.status}
                </span>
              </div>

              {/* Details Row */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {new Date(booking.date).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {booking.timeSlot}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                    <Users className="w-3 h-3 text-slate-400" />
                    {booking.guests} {booking.guests === 1 ? "Guest" : "Guests"}
                  </div>
                </div>

                {/* Special Request */}
                {booking.specialRequest && (
                  <div className="mt-3 flex items-start gap-2 bg-amber-50 rounded-xl p-2.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      {booking.specialRequest}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {actions.length > 0 && (
                <div className="px-4 pb-3 flex gap-2">
                  {actions.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.status}
                        disabled={isProcessing}
                        onClick={() => handleStatusChange(booking._id, action.status)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${action.color}`}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
                        )}
                        {isProcessing ? "..." : action.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
