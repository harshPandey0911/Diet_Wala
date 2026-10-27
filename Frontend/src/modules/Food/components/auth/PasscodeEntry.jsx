import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react"

export default function PasscodeEntry({ phone, api, onSuccess, onUseOtp, onBack, accent = "#E53935" }) {
  const [digits, setDigits] = useState(["", "", "", ""])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const refs = useRef([])
  const submitting = useRef(false)

  useEffect(() => { refs.current[0]?.focus() }, [])

  const submit = async (value) => {
    if (submitting.current || !/^\d{4}$/.test(value)) return
    submitting.current = true
    setLoading(true); setError("")
    try {
      const response = await api.loginWithPasscode(phone, value)
      await onSuccess(response?.data?.data || response?.data)
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "Incorrect passcode. Please try again.")
      setDigits(["", "", "", ""])
      requestAnimationFrame(() => refs.current[0]?.focus())
    } finally { setLoading(false); submitting.current = false }
  }

  const useOtp = async () => {
    if (loading) return
    setLoading(true); setError("")
    try { await onUseOtp() }
    catch (err) { setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Could not send OTP. Please try again."); setLoading(false) }
  }

  const update = (index, raw) => {
    if (loading) return
    const value = raw.replace(/\D/g, "").slice(-1)
    const next = [...digits]; next[index] = value; setDigits(next); setError("")
    if (value && index < 3) refs.current[index + 1]?.focus()
    if (next.every(Boolean)) submit(next.join(""))
  }

  const keyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits]; next[index - 1] = ""; setDigits(next); refs.current[index - 1]?.focus()
    }
  }

  const paste = (event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4).split("")
    const next = ["", "", "", ""]; pasted.forEach((digit, index) => { next[index] = digit }); setDigits(next)
    if (pasted.length === 4) submit(next.join("")); else refs.current[pasted.length]?.focus()
  }

  return <div className="w-full max-w-md mx-auto rounded-3xl bg-white dark:bg-[#1a1a1a] p-7 shadow-2xl border border-gray-100 dark:border-gray-800">
    <button type="button" onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
    <div className="text-center mb-7"><ShieldCheck className="w-12 h-12 mx-auto mb-3" style={{ color: accent }} /><h2 className="text-2xl font-black dark:text-white">Enter Passcode</h2><p className="text-sm text-gray-500 mt-2">Enter the 4-digit passcode for ••••••{String(phone).replace(/\D/g, "").slice(-4)}</p></div>
    <div className="grid grid-cols-4 gap-3" onPaste={paste}>{digits.map((digit, index) => <input key={index} ref={(node) => { refs.current[index] = node }} value={digit} onChange={(e) => update(index, e.target.value)} onKeyDown={(e) => keyDown(index, e)} disabled={loading} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} type="password" maxLength={1} aria-label={`Passcode digit ${index + 1}`} className="aspect-square min-w-0 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-center text-3xl font-black outline-none focus:border-current" style={{ color: accent }} />)}</div>
    {error && <p role="alert" className="mt-4 text-center text-sm font-semibold text-red-600">{error}</p>}
    <div className="h-8 mt-2 flex justify-center">{loading && <Loader2 className="animate-spin" style={{ color: accent }} />}</div>
    <div className="mt-2 flex justify-end"><button type="button" disabled={loading} onClick={useOtp} className="text-right text-sm font-bold hover:underline disabled:opacity-60" style={{ color: accent }}>Forgot Passcode? Login via OTP</button></div>
  </div>
}
