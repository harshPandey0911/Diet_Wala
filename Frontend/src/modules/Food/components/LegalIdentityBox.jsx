/**
 * Names the app and the developer at the top of every privacy policy / terms page, exactly as the
 * store listing must show them (Google Play checks that the policy identifies both).
 */
export default function LegalIdentityBox({ appName, company, address, email, className = "" }) {
  return (
    <div className={`rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3 text-sm text-gray-800 dark:text-gray-200 space-y-1 ${className}`}>
      <p><span className="font-semibold">App:</span> {appName}</p>
      <p><span className="font-semibold">Developer / legal entity:</span> {company}</p>
      {address ? <p><span className="font-semibold">Address:</span> {address}</p> : null}
      {email ? <p><span className="font-semibold">Contact:</span> {email}</p> : null}
    </div>
  )
}
