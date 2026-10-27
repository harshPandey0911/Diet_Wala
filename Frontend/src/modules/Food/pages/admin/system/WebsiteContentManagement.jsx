import { useEffect, useMemo, useState } from "react"
import { Globe, Save, Loader2, Trash2, Plus, ArrowUp, ArrowDown, ChevronDown, RotateCcw, ExternalLink, CheckCircle2, AlertCircle, Upload, MessageSquare, Phone } from "lucide-react"
import api from "@food/api"
import { getModuleToken } from "@food/utils/auth"
import { getMediaUrl } from "@/shared/utils/media"
import { WEBSITE_DEFAULTS } from "../../../../../app/website/websiteDefaults.js"
import { WEBSITE_ICONS } from "../../../../../app/website/websiteIcons.js"

/**
 * Admin > Website Content.
 * Tab "Main website": everything on the public promotional website (https://dietvala.com/) - texts, pictures,
 * Play Store / App Store links, contact details. Tab "App website view": headings of the desktop view of the
 * user app (/food/user), whose categories, meals and prices are real app data. Tab "Messages": what visitors
 * sent through the website contact form.
 */

const ICON_NAMES = Object.keys(WEBSITE_ICONS)

const iconField = { key: "icon", label: "Icon", type: "icon" }

const APP_SECTIONS = [
  {
    id: "hero",
    title: "Top section (Hero)",
    fields: [
      { key: "hero.tags", label: "Small line above the title", type: "strings", max: 5, blank: "New tag" },
      { key: "hero.titleLine1", label: "Title - line 1" },
      { key: "hero.titlePrefix", label: "Title - line 2 (black part)" },
      { key: "hero.titleHighlight", label: "Title - line 2 (green part)" },
      { key: "hero.description", label: "Description", type: "textarea" },
      { key: "hero.primaryCta", label: "Green button text (scrolls to the menu)" },
      { key: "hero.secondaryCta", label: "Outline button text (opens Under 250)" },
      {
        key: "hero.highlights", label: "Icons row (4 recommended)", type: "list", itemLabel: "Highlight", max: 6,
        blank: { icon: "leaf", title: "Title", text: "Text" },
        fields: [iconField, { key: "title", label: "Line 1" }, { key: "text", label: "Line 2" }],
      },
    ],
  },
  {
    id: "why",
    title: "Why Choose",
    toggle: "why.visible",
    fields: [
      { key: "why.title", label: "Title" },
      { key: "why.highlight", label: "Green title" },
      { key: "why.subtitle", label: "Subtitle" },
      {
        key: "why.items", label: "Cards", type: "list", itemLabel: "Card", max: 6,
        blank: { icon: "leaf", title: "Title", text: "Text" },
        fields: [iconField, { key: "title", label: "Title" }, { key: "text", label: "Text", type: "textarea", rows: 2 }],
      },
    ],
  },
  {
    id: "menu",
    title: "Our Menu (shows your real categories)",
    toggle: "menu.visible",
    fields: [
      { key: "menu.eyebrow", label: "Small heading" },
      { key: "menu.title", label: "Title" },
      { key: "menu.highlight", label: "Green title" },
      { key: "menu.subtitle", label: "Subtitle" },
      { key: "menu.ctaLabel", label: "Button text" },
    ],
  },
  {
    id: "popular",
    title: "Popular Meals (shows your real restaurants & prices)",
    toggle: "popular.visible",
    fields: [
      { key: "popular.title", label: "Title" },
      { key: "popular.ctaLabel", label: "Link text" },
    ],
  },
  {
    id: "how",
    title: "How It Works",
    toggle: "how.visible",
    fields: [
      { key: "how.title", label: "Title" },
      { key: "how.subtitle", label: "Subtitle" },
      {
        key: "how.steps", label: "Steps", type: "list", itemLabel: "Step", max: 6,
        blank: { icon: "smartphone", title: "Title", text: "Text" },
        fields: [iconField, { key: "title", label: "Title" }, { key: "text", label: "Text", type: "textarea", rows: 2 }],
      },
    ],
  },
]

const SITE_SECTIONS = [
  {
    id: "site-general", group: "site", title: "Store links, WhatsApp & Header",
    fields: [
      { key: "site.stores.playStoreUrl", label: "Google Play link", help: "Full address of the app page, e.g. https://play.google.com/store/apps/details?id=... Until it is filled the button shows 'Coming soon'." },
      { key: "site.stores.appStoreUrl", label: "App Store link", help: "e.g. https://apps.apple.com/app/..." },
      { key: "site.stores.playStoreLabel", label: "Google Play button text" },
      { key: "site.stores.appStoreLabel", label: "App Store button text" },
      { key: "site.whatsappNumber", label: "WhatsApp number (optional)", help: "With country code, digits only, e.g. 919876543210. The 'Chat on WhatsApp' button in Contact appears only when this is filled." },
      { key: "site.whatsappMessage", label: "WhatsApp first message", type: "textarea", rows: 2 },
      { key: "site.header.logo", label: "Logo", type: "image", help: "Leave empty to use the default DietVala logo." },
      { key: "site.header.ctaLabel", label: "Header button text" },
      { key: "site.header.ctaHref", label: "Header button link", help: "#download scrolls to the store buttons." },
      {
        key: "site.header.nav", label: "Menu links (also used in the footer)", type: "list", itemLabel: "Link", max: 8,
        blank: { label: "New link", href: "#home" },
        fields: [{ key: "label", label: "Text" }, { key: "href", label: "Link", help: "#about, #menu, #how, #contact or a full address" }],
      },
      { key: "site.seo.title", label: "Browser title (SEO)" },
      { key: "site.seo.description", label: "Description for Google (SEO)", type: "textarea", rows: 2 },
    ],
  },
  {
    id: "site-hero", group: "site", title: "Home / Hero",
    fields: [
      { key: "site.hero.tags", label: "Small line above the title", type: "strings", max: 5, blank: "New tag" },
      { key: "site.hero.titleLine1", label: "Title - line 1" },
      { key: "site.hero.titlePrefix", label: "Title - line 2 (black part)" },
      { key: "site.hero.titleHighlight", label: "Title - line 2 (green part)" },
      { key: "site.hero.description", label: "Description", type: "textarea" },
      { key: "site.hero.storeHeading", label: "Text above the store buttons" },
      { key: "site.hero.secondaryCta", label: "Outline button text" },
      { key: "site.hero.secondaryHref", label: "Outline button link" },
      { key: "site.hero.image", label: "Big picture on the right", type: "image", help: "Recommended 1400 x 1000 px (about 4:3). Keep the food towards the right; the left edge fades into the page." },
      { key: "site.hero.script", label: "Handwritten text on the picture", type: "textarea", rows: 2 },
      {
        key: "site.hero.highlights", label: "Icons row (4 recommended)", type: "list", itemLabel: "Highlight", max: 6,
        blank: { icon: "leaf", title: "Title", text: "Text" },
        fields: [iconField, { key: "title", label: "Line 1" }, { key: "text", label: "Line 2" }],
      },
    ],
  },
  {
    id: "site-why", group: "site", title: "Why Choose", toggle: "site.why.visible",
    fields: [
      { key: "site.why.title", label: "Title" },
      { key: "site.why.highlight", label: "Green title" },
      { key: "site.why.subtitle", label: "Subtitle" },
      {
        key: "site.why.items", label: "Cards", type: "list", itemLabel: "Card", max: 6,
        blank: { icon: "leaf", title: "Title", text: "Text" },
        fields: [iconField, { key: "title", label: "Title" }, { key: "text", label: "Text", type: "textarea", rows: 2 }],
      },
    ],
  },
  {
    id: "site-about", group: "site", title: "About Us / Our Story", toggle: "site.about.visible",
    fields: [
      { key: "site.about.eyebrow", label: "Small heading" },
      { key: "site.about.title", label: "Title" },
      { key: "site.about.paragraphs", label: "Paragraphs", type: "strings", textarea: true, max: 4, blank: "New paragraph" },
      { key: "site.about.ctaLabel", label: "Button text" },
      { key: "site.about.ctaHref", label: "Button link" },
      { key: "site.about.image", label: "Picture (left)", type: "image", help: "Recommended 1200 x 800 px." },
      { key: "site.about.script", label: "Handwritten text", type: "textarea", rows: 2 },
      {
        key: "site.about.points", label: "Points on the right", type: "list", itemLabel: "Point", max: 6,
        blank: { icon: "leaf", title: "Title", text: "Text" },
        fields: [iconField, { key: "title", label: "Title" }, { key: "text", label: "Text" }],
      },
    ],
  },
  {
    id: "site-menu", group: "site", title: "Our Menu", toggle: "site.menu.visible",
    fields: [
      { key: "site.menu.eyebrow", label: "Small heading" },
      { key: "site.menu.title", label: "Title" },
      { key: "site.menu.highlight", label: "Green title" },
      { key: "site.menu.subtitle", label: "Subtitle" },
      { key: "site.menu.ctaLabel", label: "Button text" },
      { key: "site.menu.ctaHref", label: "Button link", help: "#download scrolls to the store buttons." },
      {
        key: "site.menu.categories", label: "Menu cards", type: "list", itemLabel: "Card", max: 12,
        blank: { name: "New meal", subtitle: "Fresh • Healthy", prices: "₹150 / ₹200", image: "" },
        fields: [{ key: "name", label: "Name" }, { key: "subtitle", label: "Short line" }, { key: "prices", label: "Prices" }, { key: "image", label: "Picture", type: "image", help: "Recommended 800 x 600 px (4:3)." }],
      },
    ],
  },
  {
    id: "site-how", group: "site", title: "How It Works", toggle: "site.how.visible",
    fields: [
      { key: "site.how.title", label: "Title" },
      { key: "site.how.subtitle", label: "Subtitle" },
      { key: "site.how.image", label: "Picture (right)", type: "image", help: "Recommended 1200 x 750 px (16:10)." },
      { key: "site.how.script", label: "Handwritten text", type: "textarea", rows: 2 },
      {
        key: "site.how.steps", label: "Steps", type: "list", itemLabel: "Step", max: 6,
        blank: { icon: "smartphone", title: "Title", text: "Text" },
        fields: [iconField, { key: "title", label: "Title" }, { key: "text", label: "Text", type: "textarea", rows: 2 }],
      },
    ],
  },
  {
    id: "site-testimonials", group: "site", title: "Customer Reviews", toggle: "site.testimonials.visible",
    fields: [
      { key: "site.testimonials.title", label: "Title" },
      {
        key: "site.testimonials.items", label: "Reviews (3 are shown at a time, the rest go in the slider)", type: "list", itemLabel: "Review", max: 15,
        blank: { name: "Customer name", role: "Customer", rating: 5, avatar: "", text: "Write the review here." },
        fields: [
          { key: "name", label: "Name" }, { key: "role", label: "Tag (e.g. Gym Member)" },
          { key: "rating", label: "Stars (1-5)", type: "number" }, { key: "avatar", label: "Photo", type: "image", help: "Square, 200 x 200 px." },
          { key: "text", label: "Review", type: "textarea", rows: 3 },
        ],
      },
    ],
  },
  {
    id: "site-contact", group: "site", title: "Contact Us", toggle: "site.contact.visible",
    fields: [
      { key: "site.contact.title", label: "Title" },
      { key: "site.contact.subtitle", label: "Subtitle", type: "textarea", rows: 2 },
      { key: "site.contact.whatsappLabel", label: "WhatsApp button text" },
      { key: "site.contact.phone", label: "Phone number shown" },
      { key: "site.contact.phoneNote", label: "Small text under phone" },
      { key: "site.contact.email", label: "Email shown" },
      { key: "site.contact.emailNote", label: "Small text under email" },
      { key: "site.contact.hours", label: "Business hours", type: "textarea", rows: 2 },
      { key: "site.contact.locationsTitle", label: "Locations heading" },
      { key: "site.contact.locations", label: "Delivery locations", type: "textarea", rows: 3 },
      { key: "site.contact.formTitle", label: "Form heading" },
      { key: "site.contact.formButton", label: "Form button text" },
      { key: "site.contact.formSuccess", label: "Message shown after sending", type: "textarea", rows: 2 },
    ],
  },
  {
    id: "site-footer", group: "site", title: "Footer & Social Links",
    fields: [
      { key: "site.footer.social.instagram", label: "Instagram link" },
      { key: "site.footer.social.facebook", label: "Facebook link" },
      { key: "site.footer.social.youtube", label: "YouTube link" },
      { key: "site.footer.copyright", label: "Copyright text" },
    ],
  },
]

// ---------- helpers ----------
const getIn = (obj, path) => path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
const setIn = (obj, path, value) => {
  const [head, ...rest] = path.split(".")
  return { ...obj, [head]: rest.length ? setIn(obj?.[head] || {}, rest.join("."), value) : value }
}
const clone = (value) => JSON.parse(JSON.stringify(value))
const move = (list, from, to) => {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"

function ImageInput({ value, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "food/website")
      const token = getModuleToken("admin")
      const res = await api.post("/uploads/image", formData, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      const url = res?.data?.data?.url
      if (!url) throw new Error("No address returned")
      onChange(url)
    } catch (err) {
      setError(err?.response?.data?.message || "Upload failed. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-24 h-16 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
          {value ? <img src={getMediaUrl(value)} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-slate-400">No picture</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white cursor-pointer hover:bg-slate-700">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {busy ? "Uploading..." : "Upload"}
            <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = "" }} />
          </label>
          {value ? (
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          ) : null}
        </div>
      </div>
      <input className={inputClass} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="...or paste a picture address (https://...)" />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function Field({ def, value, onChange }) {
  const common = { value: value ?? "", onChange: (e) => onChange(e.target.value), className: inputClass }
  let control
  if (def.type === "textarea") control = <textarea rows={def.rows || 3} {...common} />
  else if (def.type === "image") control = <ImageInput value={value} onChange={onChange} />
  else if (def.type === "number") control = <input type="number" min={1} max={5} {...common} onChange={(e) => onChange(Number(e.target.value))} />
  else if (def.type === "icon") {
    const Cmp = WEBSITE_ICONS[value] || WEBSITE_ICONS.leaf
    control = (
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-full bg-amber-300 flex items-center justify-center shrink-0"><Cmp className="w-4 h-4 text-slate-900" /></span>
        <select {...common}>{ICON_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}</select>
      </div>
    )
  } else control = <input type="text" {...common} />

  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">{def.label}</span>
      {control}
      {def.help ? <span className="block text-[11px] text-slate-500 mt-1">{def.help}</span> : null}
    </label>
  )
}

function StringList({ def, value, onChange }) {
  const list = Array.isArray(value) ? value : []
  return (
    <div>
      <span className="block text-xs font-semibold text-slate-700 mb-1">{def.label}</span>
      <div className="space-y-2">
        {list.map((text, index) => (
          <div key={index} className="flex gap-2">
            {def.textarea
              ? <textarea rows={3} className={inputClass} value={text} onChange={(e) => onChange(list.map((t, i) => (i === index ? e.target.value : t)))} />
              : <input className={inputClass} value={text} onChange={(e) => onChange(list.map((t, i) => (i === index ? e.target.value : t)))} />}
            <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))} className="shrink-0 rounded-lg border border-slate-300 px-2.5 text-red-600 hover:bg-red-50" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      {list.length < (def.max || 10) ? (
        <button type="button" onClick={() => onChange([...list, def.blank || ""])} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"><Plus className="w-3.5 h-3.5" /> Add</button>
      ) : null}
    </div>
  )
}

function ObjectList({ def, value, onChange }) {
  const list = Array.isArray(value) ? value : []
  const update = (index, key, next) => onChange(list.map((item, i) => (i === index ? { ...item, [key]: next } : item)))
  return (
    <div>
      <span className="block text-xs font-semibold text-slate-700 mb-2">{def.label}</span>
      <div className="space-y-3">
        {list.map((item, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600">{def.itemLabel} {index + 1}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onChange(move(list, index, index - 1))} disabled={index === 0} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => onChange(move(list, index, index + 1))} disabled={index === list.length - 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))} className="p-1.5 rounded text-red-600 hover:bg-red-50" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {def.fields.map((sub) => (
                <div key={sub.key} className={sub.type === "textarea" || sub.type === "image" ? "md:col-span-2" : ""}>
                  <Field def={sub} value={item?.[sub.key]} onChange={(next) => update(index, sub.key, next)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {list.length < (def.max || 10) ? (
        <button type="button" onClick={() => onChange([...list, clone(def.blank)])} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><Plus className="w-3.5 h-3.5" /> Add {def.itemLabel.toLowerCase()}</button>
      ) : null}
    </div>
  )
}

function Section({ section, open, onToggleOpen, content, defaults, onChange }) {
  const visible = section.toggle ? getIn(content, section.toggle) !== false : true
  const resetSection = () => {
    if (!window.confirm(`Reset "${section.title}" to the original text and pictures?`)) return
    let next = content
    section.fields.forEach((field) => { next = setIn(next, field.key, clone(getIn(defaults, field.key) ?? "")) })
    onChange(next)
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <button type="button" onClick={onToggleOpen} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <span className="font-bold text-slate-900">{section.title}</span>
          {section.toggle && !visible ? <span className="text-[11px] font-semibold rounded-full bg-slate-200 text-slate-600 px-2 py-0.5">Hidden</span> : null}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          {section.toggle ? (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" checked={visible} onChange={(e) => onChange(setIn(content, section.toggle, e.target.checked))} className="w-4 h-4 accent-emerald-600" />
              Show this section on the website
            </label>
          ) : null}
          {section.fields.map((field) => {
            const value = getIn(content, field.key)
            const set = (next) => onChange(setIn(content, field.key, next))
            if (field.type === "list") return <ObjectList key={field.key} def={field} value={value} onChange={set} />
            if (field.type === "strings") return <StringList key={field.key} def={field} value={value} onChange={set} />
            return <Field key={field.key} def={field} value={value} onChange={set} />
          })}
          <button type="button" onClick={resetSection} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-600"><RotateCcw className="w-3.5 h-3.5" /> Reset this section to original</button>
        </div>
      ) : null}
    </div>
  )
}

function Enquiries({ onCountChange }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await api.get("/food/admin/website-enquiries")
      const list = res?.data?.data?.enquiries || []
      setItems(list)
      onCountChange?.(list.filter((item) => item.status === "new").length)
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load messages.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (id, status) => { await api.patch(`/food/admin/website-enquiries/${id}`, { status }); load() }
  const remove = async (id) => {
    if (!window.confirm("Delete this message?")) return
    await api.delete(`/food/admin/website-enquiries/${id}`)
    load()
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
  if (error) return <p className="text-sm text-red-600 py-6">{error}</p>
  if (!items.length) return <p className="text-sm text-slate-500 py-10 text-center">No messages yet. Messages sent from the website contact form will appear here.</p>

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const digits = String(item.phone || "").replace(/\D/g, "")
        return (
          <div key={item._id} className={`rounded-xl border p-4 bg-white ${item.status === "new" ? "border-emerald-300 shadow-sm" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{item.name}</span>
                  {item.status === "new" ? <span className="text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">New</span> : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="w-3.5 h-3.5" /> {item.phone}</a>
                  {digits ? <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline"><ExternalLink className="w-3.5 h-3.5" /> WhatsApp</a> : null}
                  <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setStatus(item._id, item.status === "new" ? "read" : "new")} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{item.status === "new" ? "Mark as read" : "Mark as new"}</button>
                <button type="button" onClick={() => remove(item._id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-800 whitespace-pre-wrap break-words">{item.message}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function WebsiteContentManagement() {
  const [content, setContent] = useState(null)
  const [saved, setSaved] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [tab, setTab] = useState("site")
  const [newEnquiries, setNewEnquiries] = useState(0)
  const [openId, setOpenId] = useState("site-general")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: "", text: "" })

  useEffect(() => {
    let cancelled = false
    api.get("/food/admin/website-content")
      .then((res) => {
        if (cancelled) return
        const data = res?.data?.data
        // A backend that is not restarted yet does not know the "site" part: fall back to the built-in defaults
        // so every text and picture is still shown and editable.
        const withDefaults = { ...clone(WEBSITE_DEFAULTS), ...clone(data.content) }
        if (!data.content?.site) withDefaults.site = clone(WEBSITE_DEFAULTS.site)
        setContent(withDefaults)
        setSaved(clone(withDefaults))
        setDefaults({ ...WEBSITE_DEFAULTS, ...(data.defaults || {}) })
        setNewEnquiries(data.newEnquiries || 0)
      })
      .catch((err) => { if (!cancelled) setStatus({ type: "error", text: err?.response?.data?.message || "Could not load the website content." }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const dirty = useMemo(() => content && saved && JSON.stringify(content) !== JSON.stringify(saved), [content, saved])

  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const save = async () => {
    setSaving(true)
    setStatus({ type: "", text: "" })
    try {
      const res = await api.put("/food/admin/website-content", { content })
      const next = res?.data?.data
      setContent(clone(next))
      setSaved(clone(next))
      try { localStorage.removeItem("dietvala_website_content_v2"); localStorage.removeItem("dietvala_site_content_v1") } catch { /* storage unavailable */ }
      setStatus({ type: "ok", text: "Saved. The website now shows your changes." })
    } catch (err) {
      setStatus({ type: "error", text: err?.response?.data?.message || "Could not save. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center"><Globe className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Website Content</h1>
              <p className="text-sm text-slate-600">Edit the public website (dietvala.com): texts, pictures, Play Store / App Store links and contact details.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink className="w-4 h-4" /> View website</a>
            {tab !== "messages" && (
              <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? "Saving..." : "Save changes"}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: "site", label: "Main website (dietvala.com)" },
            { id: "app", label: "App website view (/food/user)" },
          ].map((t) => (
            <button key={t.id} type="button" onClick={() => { setTab(t.id); setOpenId(t.id === "site" ? "site-general" : "hero") }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.id ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>{t.label}</button>
          ))}
          <button type="button" onClick={() => setTab("messages")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${tab === "messages" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
            <MessageSquare className="w-4 h-4" /> Messages
            {newEnquiries > 0 ? <span className="rounded-full bg-emerald-500 text-white text-[11px] px-1.5 py-0.5">{newEnquiries}</span> : null}
          </button>
        </div>

        {status.text ? (
          <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${status.type === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {status.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {status.text}
          </div>
        ) : null}

        {tab === "messages" ? <Enquiries onCountChange={setNewEnquiries} /> : loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
        ) : content ? (
          <div className="space-y-3">
            {(tab === "site" ? SITE_SECTIONS : APP_SECTIONS).map((section) => (
              <Section
                key={section.id}
                section={section}
                open={openId === section.id}
                onToggleOpen={() => setOpenId(openId === section.id ? "" : section.id)}
                content={content}
                defaults={defaults}
                onChange={setContent}
              />
            ))}
            {dirty ? <p className="text-xs text-amber-700 text-center pt-2">You have unsaved changes.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
