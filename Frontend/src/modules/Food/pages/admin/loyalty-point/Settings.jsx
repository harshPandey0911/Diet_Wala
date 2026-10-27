import { useEffect, useState } from "react"
import { Save, Loader2, Award, Info } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const debugError = (...args) => {}

const EMPTY_FORM = {
  pointsPerRupee: "",
  pointsPerRupeeRedemption: "",
  minOrderValueToEarn: "",
  minPointsToRedeem: "",
  maxRedeemPercentPerOrder: "",
  isActive: true,
}

export default function LoyaltyPointSettings() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState(EMPTY_FORM)

  const applySettings = (s) => {
    if (!s) {
      setSettings(EMPTY_FORM)
      return
    }
    setSettings({
      pointsPerRupee: s.pointsPerRupee ?? "",
      pointsPerRupeeRedemption: s.pointsPerRupeeRedemption ?? "",
      minOrderValueToEarn: s.minOrderValueToEarn ?? "",
      minPointsToRedeem: s.minPointsToRedeem ?? "",
      maxRedeemPercentPerOrder: s.maxRedeemPercentPerOrder ?? "",
      isActive: s.isActive !== false,
    })
  }

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getLoyaltySettings()
      if (res?.data?.success) {
        applySettings(res.data.data?.settings)
      }
    } catch (e) {
      debugError("Error fetching loyalty settings:", e)
      toast.error("Failed to load loyalty points settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      const body = {
        pointsPerRupee: settings.pointsPerRupee === "" ? 0 : Number(settings.pointsPerRupee),
        pointsPerRupeeRedemption: settings.pointsPerRupeeRedemption === "" ? 1 : Number(settings.pointsPerRupeeRedemption),
        minOrderValueToEarn: settings.minOrderValueToEarn === "" ? 0 : Number(settings.minOrderValueToEarn),
        minPointsToRedeem: settings.minPointsToRedeem === "" ? 0 : Number(settings.minPointsToRedeem),
        maxRedeemPercentPerOrder: settings.maxRedeemPercentPerOrder === "" ? 0 : Number(settings.maxRedeemPercentPerOrder),
        isActive: settings.isActive,
      }
      const res = await adminAPI.createOrUpdateLoyaltySettings(body)
      if (res?.data?.success) {
        toast.success("Loyalty points settings saved successfully")
        applySettings(res.data.data?.settings)
      } else {
        toast.error(res?.data?.message || "Failed to save loyalty points settings")
      }
    } catch (e) {
      debugError("Error saving loyalty settings:", e)
      toast.error(e?.response?.data?.message || "Failed to save loyalty points settings")
    } finally {
      setSaving(false)
    }
  }

  const onNumberChange = (key) => (e) => {
    const v = String(e.target.value ?? "")
      .replace(/[^\d.]/g, "")
      .replace(/^0+(\d)/, "$1")
    setSettings((prev) => ({ ...prev, [key]: v }))
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <Award className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Loyalty Points Settings</h1>
        </div>
        <p className="text-sm text-slate-600">
          Configure how many points customers earn per order, and how many points they need to redeem free food.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Configuration</h2>
              <p className="text-sm text-slate-500 mt-1">
                Changes apply instantly to new orders and redemptions.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={settings.isActive}
                  onChange={(e) => setSettings((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-orange-600"
                />
                Program Active
              </label>
              <Button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Earning Points</h3>
                <label className="block text-sm text-slate-600 mb-1">Points earned per ₹1 of order value</label>
                <input
                  value={settings.pointsPerRupee}
                  onChange={onNumberChange("pointsPerRupee")}
                  inputMode="decimal"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="e.g. 1"
                />
                <label className="block text-sm text-slate-600 mb-1 mt-3">Minimum order value to earn points (₹)</label>
                <input
                  value={settings.minOrderValueToEarn}
                  onChange={onNumberChange("minOrderValueToEarn")}
                  inputMode="numeric"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="e.g. 99"
                />
                <p className="flex items-start gap-1.5 text-xs text-slate-400 mt-3">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Points are credited once an order is delivered.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Redeeming Points</h3>
                <label className="block text-sm text-slate-600 mb-1">Points required for ₹1 of free food</label>
                <input
                  value={settings.pointsPerRupeeRedemption}
                  onChange={onNumberChange("pointsPerRupeeRedemption")}
                  inputMode="numeric"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="e.g. 10"
                />
                <label className="block text-sm text-slate-600 mb-1 mt-3">Minimum points balance to redeem</label>
                <input
                  value={settings.minPointsToRedeem}
                  onChange={onNumberChange("minPointsToRedeem")}
                  inputMode="numeric"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="e.g. 100"
                />
                <label className="block text-sm text-slate-600 mb-1 mt-3">Max % of order payable with points</label>
                <input
                  value={settings.maxRedeemPercentPerOrder}
                  onChange={onNumberChange("maxRedeemPercentPerOrder")}
                  inputMode="numeric"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="e.g. 50"
                />
              </div>

              {settings.pointsPerRupee !== "" && settings.pointsPerRupeeRedemption !== "" && (
                <div className="md:col-span-2 rounded-xl bg-orange-50 border border-orange-100 p-4 text-sm text-orange-800">
                  <span className="font-semibold">Example: </span>
                  On a ₹{Number(settings.minOrderValueToEarn) || 100} order, a customer earns{" "}
                  <span className="font-semibold">
                    {Math.floor((Number(settings.minOrderValueToEarn) || 100) * (Number(settings.pointsPerRupee) || 0))} points
                  </span>
                  , and {Number(settings.pointsPerRupeeRedemption) || 1} points can later be redeemed for ₹1 of free food.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
