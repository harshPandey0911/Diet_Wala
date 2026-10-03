import { useState } from "react"
import { Wallet } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

/**
 * Shared admin control to credit/debit any actor's wallet (user, restaurant, or
 * delivery partner). Every adjustment requires a reason and is recorded on the
 * shared Transaction ledger for audit (see Backend adminWallet.service.js).
 */
export default function WalletAdjustModal({ open, onClose, entityType, entityId, entityLabel, onSuccess }) {
  const [action, setAction] = useState("credit")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setAction("credit")
    setAmount("")
    setReason("")
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose?.()
  }

  const handleSubmit = async () => {
    const numericAmount = Number(amount)
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    if (!reason.trim()) {
      toast.error("Please enter a reason for this adjustment")
      return
    }

    try {
      setSubmitting(true)
      const response = await adminAPI.adjustEntityWallet({
        entityType,
        entityId,
        action,
        amount: numericAmount,
        reason: reason.trim(),
      })
      if (response?.data?.success) {
        toast.success(`Wallet ${action === "credit" ? "credited" : "debited"} successfully`)
        reset()
        onClose?.()
        onSuccess?.(response.data.data)
      } else {
        toast.error(response?.data?.message || "Failed to adjust wallet")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to adjust wallet")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose() }}>
      <DialogContent className="max-w-md mx-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 bg-slate-50">
          <DialogTitle className="pr-12 text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            Adjust Wallet{entityLabel ? ` — ${entityLabel}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAction("credit")}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                action === "credit"
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Add Money (Credit)
            </button>
            <button
              type="button"
              onClick={() => setAction("debit")}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                action === "debit"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Deduct Money (Debit)
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              placeholder="Enter amount"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this adjustment being made? (required, shown in the transaction history)"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className={`flex-1 ${action === "debit" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Processing..." : action === "credit" ? "Add Money" : "Deduct Money"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
