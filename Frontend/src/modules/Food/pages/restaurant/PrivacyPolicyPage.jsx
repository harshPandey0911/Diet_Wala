import { motion } from "framer-motion"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import api from "@food/api"
import { loadBusinessSettings, getCachedSettings } from "@food/utils/businessSettings"

// Shown only when the admin has not written a restaurant-specific policy yet (Admin > Legal > Privacy > Restaurant).
const DEFAULT_SECTIONS = (appName, company, supportEmail) => [
  {
    title: "1. About this policy",
    body: [
      `This Privacy Policy applies to the mobile/web application "${appName}" (the "App"), which is provided by ${company} ("we", "us", "our") for restaurant owners and their staff ("Partners"). It explains what information we collect when you use the App, why we collect it and the choices you have.`,
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "Account details: name, mobile number, email address and the login/verification (OTP) records needed to sign you in.",
      "Restaurant and business details: restaurant name, address and location, cuisine, menu items, pictures, opening hours, FSSAI/GST/PAN and bank or UPI details provided for onboarding and payouts.",
      "Order information: orders received by your restaurant, items, amounts, status, ratings, complaints and feedback.",
      "Device information: device type, app version, push-notification (FCM) token and approximate or precise location where you allow it, used to deliver order alerts and keep the App working.",
    ],
  },
  {
    title: "3. How we use your information",
    body: [
      "To register and verify your restaurant, show you incoming orders and let you manage your menu, availability and earnings.",
      "To send order alerts, calls and notifications to your device.",
      "To process payouts and settlements, prevent fraud, provide support and comply with the law.",
      "To improve the App and fix problems.",
    ],
  },
  {
    title: "4. Sharing of information",
    body: [
      "With customers and delivery partners only what is needed to complete an order (for example your restaurant name, address and the order details).",
      "With service providers who help us run the App, such as payment, SMS, cloud hosting and notification providers. They may use the data only to provide their service to us.",
      "With authorities when the law requires it. We do not sell your personal information.",
    ],
  },
  {
    title: "5. Data retention and security",
    body: [
      "We keep your information while your account is active and for as long as needed for legal, tax and dispute purposes. We use reasonable technical and organisational measures to protect it, but no system is completely secure.",
    ],
  },
  {
    title: "6. Your choices, access and deletion",
    body: [
      `You can view and update your restaurant profile in the App. To request correction or deletion of your account and data, write to ${supportEmail || "our support team"} from your registered mobile number or email. You can turn off location or notifications in your device settings, but some features may stop working.`,
    ],
  },
  {
    title: "7. Children",
    body: ["The App is meant for business owners and is not directed at children under 18."],
  },
  {
    title: "8. Changes and contact",
    body: [
      "We may update this policy from time to time; the date above shows the latest version.",
      `Questions about this policy: ${supportEmail || "contact our support team through the App"}.`,
    ],
  },
]

export default function PrivacyPolicyPage() {
  const goBack = useRestaurantBackNavigation()
  const [loading, setLoading] = useState(true)
  const [privacyData, setPrivacyData] = useState({ title: "", content: "", updatedAt: "" })
  const [business, setBusiness] = useState(() => getCachedSettings() || {})

  useEffect(() => {
    let cancelled = false
    const pick = (res) => {
      const payload = res?.data?.data
      return payload && (payload.content || "").trim() ? payload : null
    }
    ;(async () => {
      try {
        // The restaurant app has its own policy; the generic "privacy" page is the customer policy.
        let payload = null
        try { payload = pick(await api.get("/food/pages/privacy_restaurant")) } catch { /* fall through */ }
        if (!payload) {
          try { payload = pick(await api.get("/food/pages/privacy")) } catch { /* fall through */ }
        }
        if (!cancelled && payload) {
          setPrivacyData({ title: payload.title || "", content: payload.content || "", updatedAt: payload.updatedAt || "" })
        }
        const settings = await loadBusinessSettings()
        if (!cancelled && settings) setBusiness(settings)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const company = business?.companyName || "DietVala"
  const appName = `${company} Restaurant Partner`
  const supportEmail = business?.supportEmail || business?.email || ""
  const address = [business?.address, business?.state, business?.pincode].filter(Boolean).join(", ")
  const updated = (privacyData.updatedAt ? new Date(privacyData.updatedAt) : new Date())
    .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

  return (
    <div className="min-h-full bg-[#f6e9dc] overflow-x-hidden pb-10">
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-50 flex items-center gap-3">
        <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Back">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Privacy Policy</h1>
      </div>

      <div className="px-4 py-6 pt-[4.5rem]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6"
        >
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-gray-900">{privacyData.title || `Privacy Policy - ${appName}`}</h2>
            <p className="text-sm text-gray-600">Last updated: {updated}</p>
            {/* Identifies the app and the developer exactly as the store listing must match them */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-800 space-y-1">
              <p><span className="font-semibold">App:</span> {appName}</p>
              <p><span className="font-semibold">Developer / legal entity:</span> {company}</p>
              {address ? <p><span className="font-semibold">Address:</span> {address}</p> : null}
              {supportEmail ? <p><span className="font-semibold">Contact:</span> {supportEmail}</p> : null}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading privacy policy...</p>
          ) : privacyData.content ? (
            <div
              className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: privacyData.content }}
            />
          ) : (
            <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
              {DEFAULT_SECTIONS(appName, company, supportEmail).map((section) => (
                <section key={section.title} className="space-y-2">
                  <h3 className="text-base font-bold text-gray-900">{section.title}</h3>
                  {section.body.map((text) => <p key={text}>{text}</p>)}
                </section>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
