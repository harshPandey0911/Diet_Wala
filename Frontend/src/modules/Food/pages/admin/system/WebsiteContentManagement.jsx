import { useEffect, useMemo, useState } from "react"
import { Globe, Save, Loader2, Trash2, Plus, ArrowUp, ArrowDown, ChevronDown, RotateCcw, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react"
import api from "@food/api"
import { WEBSITE_ICONS } from "../../../../../app/website/websiteIcons.js"

/**
 * Admin > Website Content.
 * Edits the headings and short texts of the website (computer / tablet) view of the user app at /food/user.
 * Categories, meals, restaurants, prices and banners are the real app data and are managed where they always were.
 * Phones keep the existing layout.
 */

const ICON_NAMES = Object.keys(WEBSITE_ICONS)

const iconField = { key: "icon", label: "Icon", type: "icon" }

const SECTIONS = [
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

function Field({ def, value, onChange }) {
  const common = { value: value ?? "", onChange: (e) => onChange(e.target.value), className: inputClass }
  let control
  if (def.type === "textarea") control = <textarea rows={def.rows || 3} {...common} />
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
                <div key={sub.key} className={sub.type === "textarea" ? "md:col-span-2" : ""}>
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

export default function WebsiteContentManagement() {
  const [content, setContent] = useState(null)
  const [saved, setSaved] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [openId, setOpenId] = useState("hero")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: "", text: "" })

  useEffect(() => {
    let cancelled = false
    api.get("/food/admin/website-content")
      .then((res) => {
        if (cancelled) return
        const data = res?.data?.data
        setContent(clone(data.content))
        setSaved(clone(data.content))
        setDefaults(data.defaults)
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
      try { localStorage.removeItem("dietvala_website_content_v2") } catch { /* storage unavailable */ }
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
              <p className="text-sm text-slate-600">Texts of the website view (computer / tablet) of the app. Categories, meals and prices come from the app itself. Phones are not affected.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/food/user" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink className="w-4 h-4" /> View website</a>
            {(
              <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? "Saving..." : "Save changes"}
              </button>
            )}
          </div>
        </div>

        {status.text ? (
          <div className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${status.type === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {status.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {status.text}
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
        ) : content ? (
          <div className="space-y-3">
            {SECTIONS.map((section) => (
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
