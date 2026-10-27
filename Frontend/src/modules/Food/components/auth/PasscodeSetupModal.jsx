import { useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"

const FourDigitField = ({ label, value, onChange, visible, autoFocus }) => {
  const refs = useRef([])
  useEffect(() => { if (autoFocus) refs.current[0]?.focus() }, [autoFocus])
  const digits = value.padEnd(4, " ").slice(0, 4).split("")
  const change = (index, raw) => {
    const digit = raw.replace(/\D/g, "").slice(-1)
    const next = value.split(""); next[index] = digit
    onChange(next.join("").replace(/\s/g, "").slice(0, 4))
    if (digit) refs.current[index + 1]?.focus()
  }
  return <div><label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{label}</label><div className="grid grid-cols-4 gap-3" onPaste={(e) => { e.preventDefault(); const code = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4); onChange(code); refs.current[Math.min(code.length, 3)]?.focus() }}>{digits.map((digit, index) => <input key={index} ref={(node) => { refs.current[index] = node }} type={visible ? "text" : "password"} inputMode="numeric" maxLength={1} value={digit.trim()} onChange={(e) => change(index, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !digit && index > 0) refs.current[index - 1]?.focus() }} className="aspect-square min-w-0 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center text-2xl font-black outline-none focus:border-primary" />)}</div></div>
}

export default function PasscodeSetupModal({ api, hasPasscode = false, resetMode = false, required = false, onSaved, onClose }) {
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState("")
  const [visible, setVisible] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("")
  const save = async () => {
    if (!/^\d{4}$/.test(next) || !/^\d{4}$/.test(confirm)) return setError("Enter exactly 4 digits in both fields.")
    if (next !== confirm) return setError("Passcodes do not match.")
    if (hasPasscode && !resetMode && !/^\d{4}$/.test(current)) return setError("Current passcode is required.")
    setLoading(true); setError("")
    try { await api.savePasscode(next, confirm, resetMode ? undefined : (current || undefined)); await onSaved?.(); onClose?.() }
    catch (err) { setError(err?.response?.data?.error || err?.response?.data?.message || "Could not save passcode.") }
    finally { setLoading(false) }
  }
  return <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#171717] p-6 sm:p-8 shadow-2xl">
      <div className="text-center mb-6"><ShieldCheck className="w-12 h-12 text-primary mx-auto mb-2" /><h2 className="text-2xl font-black dark:text-white">{resetMode ? "Set New Passcode" : hasPasscode ? "Update Passcode" : "Set Your Passcode"}</h2><p className="text-sm text-gray-500 mt-2">{resetMode ? "OTP verified. Create a new 4-digit passcode for your next login." : "Use four digits you can remember. Your passcode is stored securely."}</p></div>
      <div className="space-y-5">{hasPasscode && !resetMode && <FourDigitField label="Current passcode" value={current} onChange={setCurrent} visible={visible} autoFocus />}<FourDigitField label="New 4-digit passcode" value={next} onChange={setNext} visible={visible} autoFocus={!hasPasscode || resetMode} /><FourDigitField label="Confirm passcode" value={confirm} onChange={setConfirm} visible={visible} /></div>
      <button type="button" onClick={() => setVisible((v) => !v)} className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">{visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{visible ? "Hide" : "Show"} passcode</button>
      {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
      <div className="mt-6 flex gap-3">{!required && <button type="button" onClick={onClose} disabled={loading} className="flex-1 rounded-xl border py-3 font-bold">Cancel</button>}<button type="button" onClick={save} disabled={loading} className="flex-1 rounded-xl bg-primary text-white py-3 font-bold flex items-center justify-center">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Passcode"}</button></div>
    </div>
  </div>
}
