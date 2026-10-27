import { useState } from "react"
import { KeyRound } from "lucide-react"
import PasscodeSetupModal from "./PasscodeSetupModal"
import { getCurrentUser, getModuleRefreshToken, getModuleToken, setAuthData } from "@food/utils/auth"

export default function SecurityPasscodeCard({ module, api, hasPasscode: initial = false }) {
  const [hasPasscode, setHasPasscode] = useState(Boolean(initial || getCurrentUser(module)?.hasPasscode))
  const [open, setOpen] = useState(false)
  const saved = () => {
    const user = { ...(getCurrentUser(module) || {}), hasPasscode: true }
    setAuthData(module, getModuleToken(module), user, getModuleRefreshToken(module))
    setHasPasscode(true); setOpen(false)
    window.dispatchEvent(new Event(`${module}AuthChanged`))
  }
  return <>
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><KeyRound className="w-5 h-5" /></div><div><h3 className="font-bold text-gray-900 dark:text-white">Security Passcode</h3><p className={`text-xs font-semibold ${hasPasscode ? "text-green-600" : "text-gray-500"}`}>{hasPasscode ? "Passcode Active" : "Not Set"}</p></div></div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">{hasPasscode ? "Update Passcode" : "Set Passcode"}</button>
    </section>
    {open && <PasscodeSetupModal api={api} hasPasscode={hasPasscode} onSaved={saved} onClose={() => setOpen(false)} />}
  </>
}
