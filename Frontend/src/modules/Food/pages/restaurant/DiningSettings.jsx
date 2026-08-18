import { useState, useEffect } from "react"
import {
  ArrowLeft,
  UtensilsCrossed,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  ChevronRight,
  Leaf,
  Send,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"
import { restaurantAPI, diningAPI } from "@food/api"
import { toast } from "sonner"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"

// ─── Toggle Component ────────────────────────────────────────────
function Toggle({ value, onChange, disabled = false }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
        value ? "bg-[#7e3866]" : "bg-slate-200"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          value ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export default function DiningSettings() {
  const goBack = useRestaurantBackNavigation()

  const [categories,        setCategories]        = useState([])
  const [diningData,        setDiningData]        = useState(null) // current approved dining config
  const [requestData,       setRequestData]       = useState(null) // pending/rejected request
  const [restaurantProfile, setRestaurantProfile] = useState(null) // active live restaurant profile
  const [loading,           setLoading]           = useState(true)
  const [submitting,        setSubmitting]        = useState(false)
  const [toggling,          setToggling]          = useState(false)
  const [isEditingConfig,   setIsEditingConfig]   = useState(false)

  // Request form state (used for none/rejected/editing state)
  const [maxGuests,      setMaxGuests]      = useState(6)
  const [selectedCats,   setSelectedCats]   = useState([])
  const [pureVeg,        setPureVeg]        = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        const [catRes, pendingRes, profileRes] = await Promise.allSettled([
          diningAPI.getCategories(),
          restaurantAPI.getPendingDiningRequest(),
          restaurantAPI.getCurrentRestaurant(),
        ])

        if (catRes.status === "fulfilled" && catRes.value.data.success) {
          setCategories(catRes.value.data.data || [])
        }

        if (profileRes.status === "fulfilled" && profileRes.value.data.success) {
          const profile = profileRes.value.data.data?.restaurant || profileRes.value.data?.restaurant
          setRestaurantProfile(profile)
        }

        if (pendingRes.status === "fulfilled" && pendingRes.value.data.success) {
          const data = pendingRes.value.data.data
          if (data?.status === "approved") {
            setDiningData(data)
            setMaxGuests(data.requestedSettings?.maxGuests ?? 6)
            setPureVeg(data.requestedSettings?.pureVeg ?? false)
            setSelectedCats(data.requestedSettings?.diningType || [])
          } else if (data) {
            setRequestData(data)
            setMaxGuests(data.requestedSettings?.maxGuests ?? 6)
            setPureVeg(data.requestedSettings?.pureVeg ?? false)
            setSelectedCats(data.requestedSettings?.diningType || [])
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // ── Derive page state ──────────────────────────────────────────
  const pageState = requestData?.status === "pending"
    ? "pending"
    : diningData
    ? "approved"
    : requestData?.status === "rejected"
    ? "rejected"
    : "none"

  // ── Handlers ──────────────────────────────────────────────────

  // For approved restaurants: live toggle on/off
  const handleLiveToggle = async (newValue) => {
    try {
      setToggling(true)
       const response = await restaurantAPI.updateDiningSettings({ isEnabled: newValue })
      if (response.data.success) {
        setRestaurantProfile((prev) => ({
          ...prev,
          diningSettings: {
            ...prev?.diningSettings,
            isEnabled: newValue
          }
        }))
        toast.success(newValue ? "Dining enabled!" : "Dining paused.")
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update dining status.")
    } finally {
      setToggling(false)
    }
  }

  // For none/rejected: submit approval request
  const toggleCategory = (id) =>
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )

  const handleSubmitRequest = async () => {
    if (selectedCats.length === 0) {
      toast.error("Please select at least one dining category.")
      return
    }
    if (maxGuests < 1 || maxGuests > 100) {
      toast.error("Max guests must be between 1 and 100.")
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        isEnabled: true, // always requesting to enable
        maxGuests: Number(maxGuests),
        diningType: selectedCats,
        pureVeg,
      }
      const response = await restaurantAPI.requestDiningUpdate(payload)
      if (response.data.success) {
        toast.success("Request submitted! Our team will review and approve it.")
        setRequestData({ status: "pending", requestedSettings: payload })
        setDiningData(null)
        setIsEditingConfig(false)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#7e3866] animate-spin" />
      </div>
    )
  }

  // ── APPROVED STATE: live toggle ────────────────────────────────
  if (pageState === "approved" && !isEditingConfig) {
    const isCurrentlyEnabled = restaurantProfile?.diningSettings?.isEnabled ?? false
    return (
      <div className="min-h-screen bg-slate-50 pb-10">
        {/* Header */}
        <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100">
          <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
            <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-900">Dining Settings</h1>
              <p className="text-xs text-slate-500">Manage your table booking</p>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            <p className="text-sm font-bold text-green-700">Dining Approved ✓</p>
          </div>

          {/* Live enable/disable toggle */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isCurrentlyEnabled ? "bg-[#f9f0f6]" : "bg-slate-100"}`}>
                  {isCurrentlyEnabled
                    ? <ToggleRight className="w-5 h-5 text-[#7e3866]" />
                    : <ToggleLeft className="w-5 h-5 text-slate-400" />
                  }
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Table Booking</p>
                  <p className="text-xs text-slate-500">
                    {isCurrentlyEnabled ? "Currently accepting bookings" : "Bookings paused"}
                  </p>
                </div>
              </div>
              {toggling
                ? <Loader2 className="w-5 h-5 text-[#7e3866] animate-spin" />
                : <Toggle value={isCurrentlyEnabled} onChange={handleLiveToggle} />
              }
            </div>
          </div>

          {/* Current config info */}
          {diningData?.requestedSettings?.maxGuests && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Current Configuration</p>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Users className="w-4 h-4 text-slate-400" />
                <span>Max <strong>{diningData.requestedSettings.maxGuests}</strong> guests per slot</span>
              </div>
              {diningData?.requestedSettings?.pureVeg && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Leaf className="w-4 h-4 text-green-500" />
                  <span>Pure Vegetarian</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 font-medium">
              To change guest limit or categories, click below to submit a new configuration update for admin approval.
            </p>
          </div>

          <button
            onClick={() => setIsEditingConfig(true)}
            className="w-full h-12 border border-[#7e3866] text-[#7e3866] hover:bg-[#7e3866]/5 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-sm mt-4"
          >
            Edit Guest Limit & Categories
          </button>
        </div>
      </div>
    )
  }

  // ── PENDING STATE: read-only, no editing ───────────────────────
  if (pageState === "pending") {
    return (
      <div className="min-h-screen bg-slate-50 pb-10">
        <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100">
          <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
            <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-900">Dining Settings</h1>
              <p className="text-xs text-slate-500">Request under review</p>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          {/* Pending status */}
          <div className="flex items-center gap-3 px-4 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-amber-700">Request Under Review</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Our team is reviewing your dining activation request. You'll be notified once it's approved.
              </p>
            </div>
          </div>

          {/* Submitted settings summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Submitted Details</p>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Max <strong>{requestData?.requestedSettings?.maxGuests ?? "—"}</strong> guests per slot</span>
            </div>
            {requestData?.requestedSettings?.pureVeg && (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Leaf className="w-4 h-4 text-green-500" />
                <span>Pure Vegetarian</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Approval usually takes 24–48 hours. You cannot change settings while a request is pending.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── NONE / REJECTED STATE: show request form ───────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={isEditingConfig ? () => setIsEditingConfig(false) : goBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">{isEditingConfig ? "Edit Settings" : "Enable Dining"}</h1>
            <p className="text-xs text-slate-500">{isEditingConfig ? "Modify capacity and categories" : "Request table booking for your restaurant"}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Rejected reason */}
        {pageState === "rejected" && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">Previous request was rejected</p>
              {requestData?.rejectionReason && (
                <p className="text-xs text-red-600 mt-0.5">Reason: {requestData.rejectionReason}</p>
              )}
              <p className="text-xs text-red-600 mt-1">You can submit a new request below.</p>
            </div>
          </div>
        )}

        {/* Explainer */}
        {pageState === "none" && (
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl">
            <Send className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 font-medium">
              Fill in the details below and submit a request. Once our team approves it, table booking will be activated for your restaurant.
            </p>
          </div>
        )}

        {/* Max Guests */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Maximum Guests per Slot</p>
              <p className="text-xs text-slate-500">How many guests can book at one time?</p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[2, 4, 6, 8, 10, 12, 15, 20, 25, 30].map((n) => (
              <button
                key={n}
                onClick={() => setMaxGuests(n)}
                className={`h-10 rounded-xl border text-sm font-bold transition-all ${
                  maxGuests === n
                    ? "border-[#7e3866] bg-[#f9f0f6] text-[#7e3866]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Custom:</span>
            <input
              type="number"
              value={maxGuests}
              min={1}
              max={100}
              onChange={(e) => setMaxGuests(Number(e.target.value) || 1)}
              className="w-20 h-8 px-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7e3866]/20 focus:border-[#7e3866]"
            />
            <span className="text-xs text-slate-500">guests max</span>
          </div>
        </div>

        {/* Dining Categories */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Dining Categories</p>
              <p className="text-xs text-slate-500">Select what best describes your dining experience</p>
            </div>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No categories available.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const selected = selectedCats.includes(cat._id)
                return (
                  <button
                    key={cat._id}
                    onClick={() => toggleCategory(cat._id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      selected
                        ? "border-[#7e3866] bg-[#7e3866] text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {selected && <CheckCircle2 className="w-3 h-3" />}
                    {cat.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Pure Veg Toggle */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Pure Vegetarian</p>
                <p className="text-xs text-slate-500">Only vegetarian items served</p>
              </div>
            </div>
            <Toggle value={pureVeg} onChange={setPureVeg} />
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-500 leading-relaxed">
            After submitting, your request will be reviewed by our team. Dining will be activated once approved (24–48 hrs).
          </p>
        </div>

        {/* Submit Button in flow */}
        <div className="pt-4">
          <button
            onClick={handleSubmitRequest}
            disabled={submitting}
            className="w-full h-14 bg-[#7e3866] hover:bg-[#6a2e54] text-white font-bold rounded-2xl shadow-lg shadow-[#7e3866]/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting Request...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {isEditingConfig ? "Submit Update Request" : (pageState === "rejected" ? "Resubmit Request" : "Send Request to Admin")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}



