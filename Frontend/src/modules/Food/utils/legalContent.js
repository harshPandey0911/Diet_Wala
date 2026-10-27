import { useEffect, useMemo, useState } from "react"
import { loadBusinessSettings, getCachedSettings } from "@food/utils/businessSettings"

/**
 * The privacy policy / terms written in the admin panel were saved as a blank template: the company name is
 * missing ("explains how  collects") and placeholders such as [SUPPORT EMAIL] or [LEGAL COMPANY NAME] are
 * still literally in the text. Google Play rejects that ("app or developer details don't match").
 * These helpers fill the gaps from Admin > Business Setup when the page is shown, so the admin only has to
 * keep the company name, support email, phone and address up to date there.
 */

const DEFAULT_PHONE_PLACEHOLDER = "1234567890"

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]))

const ROLES = {
  user: {
    appSuffix: "",
    privacyPath: "/food/user/profile/privacy",
    termsPath: "/food/user/profile/terms",
    refundPath: "/food/user/profile/refund",
    services:
      "ordering healthy meals from partner restaurants: browsing menus, placing and paying for orders, live order tracking, delivery, wallet and loyalty rewards, and customer support",
    deletion: "Profile > Delete Account",
    cancellation: "the Orders section of the App or by contacting customer support",
  },
  restaurant: {
    appSuffix: " Restaurant Partner",
    privacyPath: "/food/restaurant/privacy",
    termsPath: "/food/restaurant/terms",
    refundPath: "/food/user/profile/refund",
    services:
      "managing a partner restaurant: receiving and handling customer orders, managing the menu, availability and earnings, and support",
    deletion: "the Delete Account option in the App's profile",
    cancellation: "the Orders section of the App or by contacting support",
  },
  delivery: {
    appSuffix: " Delivery Partner",
    privacyPath: "/food/delivery/privacy",
    termsPath: "/food/delivery/terms",
    refundPath: "/food/user/profile/refund",
    services: "accepting and completing deliveries, tracking earnings and payouts, and support",
    deletion: "the Delete Account option in the App's profile",
    cancellation: "the Orders section of the App or by contacting support",
  },
}

export const buildLegalContext = (settings, role = "user") => {
  const cfg = ROLES[role] || ROLES.user
  const company = String(settings?.companyName || "DietVala").trim() || "DietVala"
  const appName = `${company}${cfg.appSuffix}`
  const email = String(settings?.supportEmail || settings?.email || "").trim()

  const rawPhone = String(settings?.supportPhone || "").trim()
  const settingsPhone = [settings?.phone?.countryCode, settings?.phone?.number].filter(Boolean).join(" ").trim()
  // The stored default ("+91 1234567890") is a dummy; never show it as a real number.
  const phone = rawPhone && !rawPhone.replace(/\D/g, "").endsWith(DEFAULT_PHONE_PLACEHOLDER) ? rawPhone : settingsPhone

  const address = [settings?.address, settings?.state, settings?.pincode].filter(Boolean).join(", ")
  const hours = String(settings?.supportHours || "").trim()
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return { cfg, company, appName, email, phone, address, hours, origin }
}

/** Replaces the missing names and [PLACEHOLDER] tokens of the saved legal text. */
export const fillLegalPlaceholders = (html, ctx) => {
  if (!html) return html
  const { cfg, company, appName, email, phone, address, hours, origin } = ctx
  const e = escapeHtml
  const emailText = email ? e(email) : "our support team in the App"
  const values = {
    "LEGAL COMPANY NAME": e(company),
    "COMPANY NAME": e(company),
    "APP NAME": e(appName),
    "PRIVACY EMAIL": emailText,
    "SUPPORT EMAIL": emailText,
    "GRIEVANCE EMAIL": emailText,
    "PAYMENT GATEWAY NAME": "Razorpay",
    "PRIVACY POLICY URL": e(`${origin}${cfg.privacyPath}`),
    "TERMS URL": e(`${origin}${cfg.termsPath}`),
    "REFUND POLICY URL OR DETAILED POLICY": e(`${origin}${cfg.refundPath}`),
    "IN-APP ACCOUNT DELETION PATH": e(cfg.deletion),
    "ACCOUNT DELETION METHOD": e(`${cfg.deletion}, or by writing to ${email || "our support team"}`),
    "ACCOUNT DELETION WEBPAGE URL": e(`${email || "our support team"} (write "Delete my account" from your registered mobile number)`),
    "CANCELLATION METHOD": e(cfg.cancellation),
    "DESCRIBE THE APP'S ACTUAL SERVICES AND FEATURES": e(cfg.services),
    "CONTACT NUMBER": e(phone || email || "the support section of the App"),
    "FULL POSTAL ADDRESS": e(address || `${company}, India`),
    "SUPPORT HOURS": e(hours || "As shown in the App"),
  }

  let out = String(html)
  // Missing names in sentences that had the name stripped out of the template.
  out = out.replace(/explains how\s+collects/gi, `explains how ${e(company)} collects`)
  out = out.replace(/By using\s*,/g, `By using ${e(appName)},`)
  out = out.replace(/(continuing to use)\s*,/gi, `$1 ${e(appName)},`)

  out = out.replace(/\[([A-Z0-9][A-Z0-9 '&/,.\-]*)\]/g, (match, token) => {
    const key = token.trim()
    if (values[key] !== undefined) return values[key]
    if (/^OFFICER NAME/.test(key)) return `${e(company)} Grievance Officer`
    if (/EMAIL/.test(key)) return emailText
    if (/URL/.test(key)) return e(`${origin}${cfg.privacyPath}`)
    if (/PHONE|NUMBER/.test(key)) return e(phone || email || "the support section of the App")
    return e(company)
  })

  // The grievance / contact sections were left empty ("contact:" and nothing after it).
  const contactBlock =
    `<p><strong>${e(company)}</strong></p>` +
    (address ? `<p>${e(address)}</p>` : "") +
    (email ? `<p>Email: ${e(email)}</p>` : "") +
    (phone ? `<p>Phone: ${e(phone)}</p>` : "")
  out = out.replace(/(<p>[^<]*(?:contact|Grievance[^<]*)[^<]*:\s*<\/p>)(\s*)(?=<p><br><\/p>\s*<p>\s*(?:\d+\.|By\s|<))/gi, `$1$2${contactBlock}`)
  out = out.replace(/(<p>[^<]*contact:\s*<\/p>)(\s*)$/i, `$1$2${contactBlock}`)
  return out
}

/** Business settings + helpers for a legal page. */
export function useLegalContext(role = "user") {
  const [settings, setSettings] = useState(() => getCachedSettings() || {})
  useEffect(() => {
    let cancelled = false
    loadBusinessSettings()
      .then((loaded) => { if (!cancelled && loaded) setSettings(loaded) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const ctx = useMemo(() => buildLegalContext(settings, role), [settings, role])
  const fill = useMemo(() => (html) => fillLegalPlaceholders(html, ctx), [ctx])
  return { ...ctx, fill }
}
