import React, { useEffect, useMemo, useRef, useState } from "react"
import { Navigate } from "react-router-dom"
import {
  Leaf, Clock, Phone, Mail, Star, Instagram, Facebook, Youtube, ArrowRight, ChevronLeft, ChevronRight,
  Loader2, CheckCircle2, MapPin, Menu, X,
} from "lucide-react"
import api from "@food/api"
import { getThumbUrl, getMediaUrl } from "@/shared/utils/media.js"
import { WEBSITE_DEFAULTS } from "./websiteDefaults.js"
import { WEBSITE_ICONS } from "./websiteIcons.js"

/**
 * The public DietVala website (https://dietvala.com/). It only promotes the app: there is no ordering here,
 * the buttons lead to the Google Play / App Store pages. All texts, links and pictures come from
 * /food/website/public and are edited in Admin > Website Content (WEBSITE_DEFAULTS is the fallback).
 */

const YELLOW = "#FFC400"
const GREEN = "#0B8A3E"
const CACHE_KEY = "dietvala_site_content_v1"

const Icon = ({ name, className = "w-5 h-5", style }) => {
  const Cmp = WEBSITE_ICONS[name] || Leaf
  return <Cmp className={className} style={style} />
}

const WhatsAppIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.39c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.29Z" />
  </svg>
)

const PlayIcon = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M3 2.6v18.8c0 .6.7 1 1.2.6l16.1-9.4c.5-.3.5-1 0-1.3L4.2 2C3.7 1.6 3 2 3 2.6Z" />
  </svg>
)

const AppleIcon = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M16.4 1.4c0 1.1-.5 2.2-1.2 3-.8.8-2.1 1.5-3.2 1.4-.1-1.1.4-2.3 1.2-3 .8-.9 2.2-1.5 3.2-1.4ZM20.5 17.3c-.6 1.3-.8 1.8-1.5 3-1 1.6-2.4 3.5-4.1 3.5-1.6 0-2-1-4.1-1-2.1 0-2.5 1-4.1 1-1.7 0-3.1-1.8-4.1-3.3C.8 16.2.5 11.1 2.2 8.5c1.2-1.8 3.1-2.9 4.9-2.9 1.8 0 3 1 4.5 1 1.5 0 2.4-1 4.4-1 1.6 0 3.3.9 4.5 2.4-3.9 2.1-3.3 7.7 0 9.3Z" />
  </svg>
)

const lines = (text) => String(text || "").split("\n")

const Script = ({ text, className = "", style }) => (
  <div className={`leading-[0.95] ${className}`} style={{ fontFamily: "'Caveat','Segoe Script',cursive", fontWeight: 700, ...style }}>
    {lines(text).map((line, i) => <div key={i}>{line}</div>)}
  </div>
)

const BrandLogo = ({ logo, dark = false }) => {
  if (logo) {
    return <img src={getThumbUrl(getMediaUrl(logo), 400)} alt="DietVala" className="h-11 w-auto object-contain" />
  }
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg className="h-11 w-auto" viewBox="0 0 240 180" fill="none" aria-hidden="true">
        <rect x="10" y="54" width="60" height="13" rx="6.5" fill={YELLOW} />
        <rect x="32" y="79" width="60" height="13" rx="6.5" fill={YELLOW} />
        <rect x="32" y="104" width="48" height="13" rx="6.5" fill={YELLOW} />
        <rect x="50" y="129" width="32" height="13" rx="6.5" fill={YELLOW} />
        <path d="M90 12 C90 12 178 8 198 46 C218 84 200 138 148 158 C112 174 66 156 66 156 L100 22 Z" fill={YELLOW} />
        <path d="M82 158 C82 158 78 92 148 48 C184 26 194 40 184 66 C170 112 110 148 82 158 Z" fill="#16A34A" />
        <path d="M86 150 C102 128 134 94 174 56" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <path d="M106 130 C114 114 126 102 136 92" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <div className="leading-none">
        <div className="text-[26px] font-black italic tracking-tight">
          <span className={dark ? "text-white" : "text-[#111]"}>Diet</span>
          <span className="not-italic text-[#2E7D32]">Vala</span>
        </div>
        <div className="mt-1 text-[8.5px] font-bold tracking-tight text-[#333] whitespace-nowrap">Healthy khana, Aapke ghar tak</div>
      </div>
    </div>
  )
}

function useReveal() {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") { setShown(true); return undefined }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect() }
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, shown]
}

const Reveal = ({ children, className = "", delay = 0 }) => {
  const [ref, shown] = useReveal()
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

const Eyebrow = ({ children, dark = false }) => (
  <div className={`flex items-center gap-1.5 text-[13px] font-semibold ${dark ? "text-[#FFC400]" : "text-[#E0A800]"}`}>
    <Leaf className="w-3.5 h-3.5" /> {children}
  </div>
)

// Google Play / App Store button. Without a link yet it shows "Coming soon" instead of a dead button.
const StoreButton = ({ kind, href, label, dark = true }) => {
  const isPlay = kind === "play"
  const ready = Boolean(href)
  const base = `inline-flex items-center gap-3 rounded-xl px-4 py-2.5 transition ${dark ? "bg-[#111] text-white" : "bg-white text-[#111] border border-black/15"} ${ready ? "hover:brightness-125 shadow-lg" : "opacity-70 cursor-default"}`
  const inner = (
    <>
      {isPlay ? <PlayIcon className="w-7 h-7 shrink-0" /> : <AppleIcon className="w-7 h-7 shrink-0" />}
      <span className="leading-tight text-left">
        <span className="block text-[10px] uppercase tracking-wide opacity-80">{ready ? (isPlay ? "Get it on" : "Download on the") : "Coming soon on"}</span>
        <span className="block text-[17px] font-bold -mt-0.5">{label}</span>
      </span>
    </>
  )
  return ready
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={base}>{inner}</a>
    : <span className={base} aria-disabled="true">{inner}</span>
}

// A phone app opened inside the Android/iOS wrapper must go straight to the app, not show the website.
const isNativeShell = () => {
  if (typeof window === "undefined") return false
  const ua = String(window.navigator?.userAgent || "").toLowerCase()
  return Boolean(window.flutter_inappwebview) || Boolean(window.ReactNativeWebView) ||
    String(window.location?.protocol || "").toLowerCase() === "file:" || ua.includes(" wv") || ua.includes("; wv")
}

export default function WebsiteLanding() {
  const native = isNativeShell()
  const [content, setContent] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null")
      return cached && typeof cached === "object" ? cached : null
    } catch { return null }
  })
  const [activeId, setActiveId] = useState("home")
  const [menuOpen, setMenuOpen] = useState(false)
  const [reviewPage, setReviewPage] = useState(0)
  const [perPage, setPerPage] = useState(3)
  const [form, setForm] = useState({ name: "", phone: "", message: "" })
  const [formState, setFormState] = useState({ status: "idle", error: "" })

  useEffect(() => {
    if (native) return undefined
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Caveat:wght@600;700&display=swap"
    document.head.appendChild(link)
    const html = document.documentElement
    const previousScroll = html.style.scrollBehavior
    html.style.scrollBehavior = "smooth"
    return () => { link.remove(); html.style.scrollBehavior = previousScroll }
  }, [native])

  useEffect(() => {
    if (native) return undefined
    let cancelled = false
    api.get("/food/website/public")
      .then((res) => {
        const site = res?.data?.data?.site
        if (cancelled || !site || typeof site !== "object") return
        setContent(site)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(site)) } catch { /* storage unavailable */ }
      })
      .catch(() => { if (!cancelled) setContent((prev) => prev || WEBSITE_DEFAULTS.site) })
    return () => { cancelled = true }
  }, [native])

  const c = content || WEBSITE_DEFAULTS.site

  useEffect(() => {
    const update = () => setPerPage(window.innerWidth >= 768 ? 3 : 1)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    if (!content || native) return undefined
    const previous = document.title
    if (c.seo?.title) document.title = c.seo.title
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta) }
    if (c.seo?.description) meta.setAttribute("content", c.seo.description)
    return () => { document.title = previous }
  }, [content, native, c.seo?.title, c.seo?.description])

  useEffect(() => {
    if (!content || native) return undefined
    const els = ["home", "about", "menu", "how", "contact"].map((id) => document.getElementById(id)).filter(Boolean)
    if (!els.length || typeof IntersectionObserver === "undefined") return undefined
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActiveId(visible.target.id)
    }, { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.2, 0.5] })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [content, native])

  const testimonials = c.testimonials?.items || []
  const pageCount = Math.max(1, Math.ceil(testimonials.length / perPage))
  useEffect(() => { if (reviewPage >= pageCount) setReviewPage(0) }, [pageCount, reviewPage])

  const social = useMemo(() => {
    const s = c.footer?.social || {}
    return [
      { key: "instagram", Cmp: Instagram, href: s.instagram },
      { key: "facebook", Cmp: Facebook, href: s.facebook },
      { key: "youtube", Cmp: Youtube, href: s.youtube },
    ].filter((item) => item.href)
  }, [c.footer?.social])

  if (native) return <Navigate to="/food/user" replace />
  if (!content) return <div className="min-h-screen bg-white" />

  const img = (src, w) => getThumbUrl(getMediaUrl(src), w)
  const nav = c.header?.nav || []
  const stores = c.stores || {}
  const pageItems = testimonials.slice(reviewPage * perPage, reviewPage * perPage + perPage)
  const waDigits = String(c.whatsappNumber || "").replace(/\D/g, "")
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(c.whatsappMessage || "")}` : ""

  const linkProps = (href) => ({
    href: href || "#",
    ...(/^https?:/i.test(href || "") ? { target: "_blank", rel: "noopener noreferrer" } : {}),
  })

  const submit = async (event) => {
    event.preventDefault()
    if (formState.status === "sending") return
    setFormState({ status: "sending", error: "" })
    try {
      await api.post("/food/website/enquiry", form)
      setForm({ name: "", phone: "", message: "" })
      setFormState({ status: "done", error: "" })
    } catch (err) {
      setFormState({ status: "error", error: err?.response?.data?.message || "Could not send your message. Please try again." })
    }
  }

  const inputClass = "w-full rounded-md bg-[#1b1b1b] border border-white/15 px-3 py-2.5 text-[12px] placeholder:text-white/45 outline-none focus:border-[#FFC400]"

  return (
    <div className="min-h-screen bg-white text-[#111] overflow-x-hidden" style={{ fontFamily: "'Poppins',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" }}>
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-black/5">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-[68px] sm:h-[72px] flex items-center justify-between gap-4">
          <a href="#home" aria-label="DietVala home"><BrandLogo logo={c.header?.logo} /></a>
          <nav className="hidden lg:flex items-center gap-2">
            {nav.map((item) => {
              const id = String(item.href || "").replace("#", "")
              const active = id && id === activeId
              return (
                <a key={`${item.label}-${item.href}`} {...linkProps(item.href)}
                  className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${active ? "bg-[#FFD21F] text-[#111]" : "text-[#222] hover:bg-[#FFF3B0]"}`}>
                  {item.label}
                </a>
              )
            })}
          </nav>
          <div className="flex items-center gap-2">
            <a {...linkProps(c.header?.ctaHref)}
              className="hidden sm:inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-md hover:brightness-110 transition"
              style={{ background: GREEN }}>
              {c.header?.ctaLabel}
            </a>
            <button type="button" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)} className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav className="lg:hidden border-t border-black/5 bg-white px-4 py-3 flex flex-col">
            {nav.map((item) => (
              <a key={`m-${item.label}-${item.href}`} {...linkProps(item.href)} onClick={() => setMenuOpen(false)} className="py-2.5 text-[14px] font-semibold">{item.label}</a>
            ))}
            <a {...linkProps(c.header?.ctaHref)} onClick={() => setMenuOpen(false)} className="mt-2 inline-flex justify-center rounded-full px-5 py-2.5 text-[13px] font-bold text-white" style={{ background: GREEN }}>{c.header?.ctaLabel}</a>
          </nav>
        ) : null}
      </header>

      {/* HERO */}
      <section id="home" className="relative scroll-mt-20 bg-[#FFFBEA] overflow-hidden">
        <div className="relative lg:absolute lg:inset-y-0 lg:right-0 lg:w-[54%] aspect-[16/10] lg:aspect-auto bg-[#FFD21F]">
          <img src={img(c.hero?.image, 1400)} alt="" className="absolute inset-0 w-full h-full object-cover" fetchPriority="high" />
          <div className="hidden lg:block absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-[#FFFBEA] to-transparent" />
          <Script text={c.hero?.script} className="hidden md:block absolute top-4 right-6 z-10 text-[34px] text-white rotate-[-6deg] text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]" />
        </div>
        <div className="relative max-w-[1240px] mx-auto px-4 sm:px-6 py-10 lg:py-16 lg:min-h-[520px] flex items-center">
          <div className="lg:max-w-[50%]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-[#222]">
              {(c.hero?.tags || []).map((tag, i) => (
                <React.Fragment key={`${tag}-${i}`}>
                  {i > 0 && <span className="text-[#999]">|</span>}
                  <span>{tag}</span>
                </React.Fragment>
              ))}
            </div>
            <h1 className="mt-5 font-extrabold leading-[1.05] tracking-tight text-[#111] text-[38px] sm:text-[46px] xl:text-[56px]">
              <span className="block">{c.hero?.titleLine1}</span>
              <span className="block">
                {c.hero?.titlePrefix}{" "}
                <span className="relative inline-block" style={{ color: GREEN }}>
                  {c.hero?.titleHighlight}
                  <svg className="absolute left-0 -bottom-2 w-full h-3" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M2 8 C 50 2, 120 2, 198 6" stroke={YELLOW} strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </span>
            </h1>
            <p className="mt-6 max-w-[470px] text-[16px] leading-relaxed text-[#222]">{c.hero?.description}</p>
            <div id="download" className="mt-7 scroll-mt-28">
              {c.hero?.storeHeading ? <div className="mb-2.5 text-[13px] font-semibold text-[#222]">{c.hero.storeHeading}</div> : null}
              <div className="flex flex-wrap items-center gap-3">
                <StoreButton kind="play" href={stores.playStoreUrl} label={stores.playStoreLabel || "Google Play"} />
                <StoreButton kind="apple" href={stores.appStoreUrl} label={stores.appStoreLabel || "App Store"} />
                <a {...linkProps(c.hero?.secondaryHref)} className="inline-flex items-center rounded-full border-[1.5px] border-[#111] px-6 py-3 text-[14px] font-bold text-[#111] hover:bg-[#111] hover:text-white transition">
                  {c.hero?.secondaryCta}
                </a>
              </div>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-y-4">
              {(c.hero?.highlights || []).map((item, i) => (
                <div key={`${item.title}-${i}`} className={`flex items-center gap-2 pr-3.5 ${i > 0 ? "pl-3.5 border-l border-black/15" : ""}`}>
                  <Icon name={item.icon} className="w-6 h-6 shrink-0" style={{ color: GREEN }} />
                  <div className="text-[11px] leading-tight text-[#222] whitespace-nowrap">
                    <div className="font-semibold">{item.title}</div>
                    <div>{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE */}
      {c.why?.visible !== false && (
        <section className="bg-[#FFFBEA] border-t border-black/5">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[250px_1fr] gap-8 items-center">
            <Reveal>
              <h2 className="text-[30px] font-extrabold leading-[1.1]">
                {c.why?.title}
                <span className="block" style={{ color: GREEN }}>{c.why?.highlight} <Leaf className="inline w-5 h-5 -mt-2" /></span>
              </h2>
              <p className="mt-3 text-[15px] text-[#333]">{c.why?.subtitle}</p>
            </Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(c.why?.items || []).map((item, i) => (
                <Reveal key={`${item.title}-${i}`} delay={i * 80}>
                  <div className="h-full bg-white rounded-2xl border border-black/5 shadow-sm px-4 py-6 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center" style={{ background: YELLOW }}>
                      <Icon name={item.icon} className="w-6 h-6 text-[#111]" />
                    </div>
                    <h3 className="mt-3 text-[15px] font-bold">{item.title}</h3>
                    <p className="mt-1 text-[12px] text-[#555] leading-snug">{item.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT */}
      {c.about?.visible !== false && (
        <section id="about" className="scroll-mt-20 bg-[#0F0F0F] text-white">
          <div className="grid lg:grid-cols-[0.8fr_1.15fr_1fr] min-h-[300px]">
            <div className="relative min-h-[220px]">
              <img src={img(c.about?.image, 1200)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0F0F0F] hidden lg:block" />
            </div>
            <Reveal className="px-6 sm:px-8 lg:px-6 py-10 flex flex-col justify-center">
              <Eyebrow dark>{c.about?.eyebrow}</Eyebrow>
              <h2 className="mt-1 text-[34px] font-extrabold">{c.about?.title}</h2>
              <div className="mt-3 space-y-3 max-w-[470px] text-[14px] leading-relaxed text-white/80">
                {(c.about?.paragraphs || []).map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <div className="mt-5">
                <a {...linkProps(c.about?.ctaHref)} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[13px] font-bold text-[#111] hover:brightness-105 transition" style={{ background: YELLOW }}>
                  {c.about?.ctaLabel} <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </Reveal>
            <div className="relative px-6 sm:px-8 py-10 flex items-center lg:border-l lg:border-white/15">
              <div className="grid gap-5 w-full">
                {(c.about?.points || []).map((item, i) => (
                  <div key={`${item.title}-${i}`} className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: YELLOW }}>
                      <Icon name={item.icon} className="w-5 h-5 text-[#111]" />
                    </div>
                    <div className="leading-tight">
                      <div className="text-[14px] font-bold">{item.title}</div>
                      <div className="text-[12px] text-white/70">{item.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Script text={c.about?.script} className="hidden xl:block absolute right-8 bottom-3 text-[26px] text-white/85 rotate-[-6deg]" />
            </div>
          </div>
        </section>
      )}

      {/* MENU */}
      {c.menu?.visible !== false && (
        <section id="menu" className="scroll-mt-20 bg-white">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[250px_1fr] gap-8 items-center">
            <Reveal>
              <Eyebrow>{c.menu?.eyebrow}</Eyebrow>
              <h2 className="mt-1 text-[30px] font-extrabold leading-[1.1]">
                {c.menu?.title}
                <span className="block" style={{ color: GREEN }}>{c.menu?.highlight}</span>
              </h2>
              <p className="mt-3 text-[14px] text-[#333]">{c.menu?.subtitle}</p>
              <a {...linkProps(c.menu?.ctaHref)} className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-[#111] hover:brightness-105 transition" style={{ background: YELLOW }}>
                {c.menu?.ctaLabel} <ArrowRight className="w-4 h-4" />
              </a>
            </Reveal>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {(c.menu?.categories || []).map((item, i) => (
                <Reveal key={`${item.name}-${i}`} delay={i * 60}>
                  <div className="h-full bg-white rounded-xl border border-black/10 shadow-sm overflow-hidden flex flex-col">
                    <div className="relative aspect-[4/3] shrink-0 bg-[#f3f0e6]">
                      <img src={img(item.image, 400)} alt={item.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                    <div className="px-3 pt-2.5 pb-3 flex-1 flex flex-col">
                      <div className="text-[13px] font-bold leading-tight">{item.name}</div>
                      <div className="mt-0.5 text-[10.5px] text-[#666] leading-snug">{item.subtitle}</div>
                      <div className="mt-auto pt-2">
                        <div className="rounded-md bg-[#FFF4C2] border border-[#FFD21F] px-1 py-1 text-center text-[9.5px] font-bold text-[#222] whitespace-nowrap">{item.prices}</div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      {c.how?.visible !== false && (
        <section id="how" className="scroll-mt-20 bg-[#FFF8DC] overflow-hidden">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[1.35fr_1fr] gap-8 items-center">
            <Reveal>
              <h2 className="text-[26px] font-extrabold">{c.how?.title}</h2>
              <p className="mt-1 text-[13px] text-[#333]">{c.how?.subtitle}</p>
              <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {(c.how?.steps || []).map((step, i) => (
                  <div key={`${step.title}-${i}`} className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-extrabold text-[#111]" style={{ background: YELLOW }}>{i + 1}</span>
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: GREEN }}>
                        <Icon name={step.icon} className="w-[18px] h-[18px]" />
                      </span>
                      {i < (c.how?.steps || []).length - 1 && <ChevronRight className="hidden xl:block w-4 h-4 text-[#9bb] ml-auto" />}
                    </div>
                    <h3 className="mt-3 text-[14px] font-bold">{step.title}</h3>
                    <p className="mt-1 text-[12px] leading-snug text-[#444]">{step.text}</p>
                  </div>
                ))}
              </div>
            </Reveal>
            <div className="relative">
              <Script text={c.how?.script} className="hidden md:block absolute top-2 left-4 z-10 text-[26px] text-white rotate-[-6deg] drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]" />
              <div className="rounded-3xl overflow-hidden shadow-xl aspect-[16/10] bg-[#111]">
                <img src={img(c.how?.image, 1200)} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      {c.testimonials?.visible !== false && testimonials.length > 0 && (
        <section className="bg-white">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10">
            <h2 className="text-[22px] font-extrabold">{c.testimonials?.title}</h2>
            <div className="mt-5 flex items-center gap-3">
              <button type="button" aria-label="Previous reviews" onClick={() => setReviewPage((p) => (p - 1 + pageCount) % pageCount)} disabled={pageCount < 2}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 hover:bg-black/5"><ChevronLeft className="w-5 h-5" /></button>
              <div className="grid md:grid-cols-3 gap-4 flex-1 min-w-0">
                {pageItems.map((item, i) => (
                  <div key={`${item.name}-${i}`} className="rounded-xl border border-black/10 shadow-sm p-4 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-[#f3f0e6] shrink-0">
                        {item.avatar && <img src={img(item.avatar, 200)} alt={item.name} loading="lazy" className="w-full h-full object-cover" />}
                      </div>
                      <div className="leading-tight">
                        <div className="text-[13px] font-bold">{item.name}</div>
                        <div className="flex gap-0.5 mt-1" aria-label={`${item.rating} out of 5`}>
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star key={s} className="w-3.5 h-3.5" style={{ color: YELLOW }} fill={s < Number(item.rating || 0) ? YELLOW : "none"} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-[12.5px] leading-relaxed text-[#333]">"{item.text}"</p>
                    <div className="mt-2 text-[10.5px] text-[#888]">{item.role}</div>
                  </div>
                ))}
              </div>
              <button type="button" aria-label="Next reviews" onClick={() => setReviewPage((p) => (p + 1) % pageCount)} disabled={pageCount < 2}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 hover:bg-black/5"><ChevronRight className="w-5 h-5" /></button>
            </div>
            {pageCount > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button key={i} type="button" aria-label={`Page ${i + 1}`} onClick={() => setReviewPage(i)} className="w-2 h-2 rounded-full" style={{ background: i === reviewPage ? YELLOW : "#d4d4d4" }} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CONTACT */}
      {c.contact?.visible !== false && (
        <section id="contact" className="scroll-mt-20 bg-[#0F0F0F] text-white">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-2 lg:grid-cols-[1fr_1.1fr_1fr_1.2fr] gap-8 items-start">
            <div>
              <h2 className="text-[24px] font-extrabold">{c.contact?.title}</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-white/75 max-w-[260px]">{c.contact?.subtitle}</p>
              {waHref ? (
                <a {...linkProps(waHref)} className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-[#111] hover:brightness-105 transition" style={{ background: YELLOW }}>
                  <WhatsAppIcon className="w-4 h-4" /> {c.contact?.whatsappLabel}
                </a>
              ) : null}
            </div>

            <div className="space-y-4 text-[12px]">
              <ContactRow icon={Phone}>
                <div className="font-bold">Phone / WhatsApp</div>
                {c.contact?.phone ? <a href={`tel:${c.contact.phone.replace(/[^\d+]/g, "")}`} className="block">{c.contact.phone}</a> : null}
                <div className="text-white/60">{c.contact?.phoneNote}</div>
              </ContactRow>
              <ContactRow icon={Mail}>
                <div className="font-bold">Email</div>
                {c.contact?.email ? <a href={`mailto:${c.contact.email}`} className="block">{c.contact.email}</a> : null}
                <div className="text-white/60">{c.contact?.emailNote}</div>
              </ContactRow>
              <ContactRow icon={Clock}>
                <div className="font-bold">Business Hours</div>
                <div className="text-white/80 whitespace-pre-line">{c.contact?.hours}</div>
              </ContactRow>
            </div>

            <ContactRow icon={MapPin}>
              <div className="font-bold text-[12px]">{c.contact?.locationsTitle}</div>
              <div className="text-[12px] text-white/80 whitespace-pre-line leading-relaxed">{c.contact?.locations}</div>
            </ContactRow>

            <form onSubmit={submit} className="space-y-3 sm:col-span-2 lg:col-span-1">
              <div className="text-[12px] font-bold">{c.contact?.formTitle}</div>
              <div className="grid grid-cols-2 gap-3">
                <input required minLength={2} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name *" className={inputClass} />
                <input required type="tel" minLength={8} maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone Number *" className={inputClass} />
              </div>
              <textarea required minLength={2} maxLength={1500} rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Your Message *" className={`${inputClass} resize-none`} />
              <button type="submit" disabled={formState.status === "sending"} className="w-full inline-flex items-center justify-center gap-2 rounded-md py-2.5 text-[13px] font-bold text-[#111] hover:brightness-105 disabled:opacity-70 transition" style={{ background: YELLOW }}>
                {formState.status === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {c.contact?.formButton} {formState.status !== "sending" && <ArrowRight className="w-4 h-4" />}
              </button>
              {formState.status === "done" && (
                <p className="flex items-start gap-2 text-[12px] text-[#9be7a8]"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {c.contact?.formSuccess}</p>
              )}
              {formState.status === "error" && <p className="text-[12px] text-[#ff9b9b]">{formState.error}</p>}
            </form>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer style={{ background: YELLOW }}>
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <BrandLogo logo={c.header?.logo} />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] font-medium text-[#111]">
            {nav.map((item) => (
              <a key={`f-${item.label}-${item.href}`} {...linkProps(item.href)} className="hover:underline">{item.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {social.map(({ key, Cmp, href }) => (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={key} className="text-[#111] hover:opacity-70"><Cmp className="w-4 h-4" /></a>
            ))}
          </div>
          <div className="text-[11px] text-[#222]">{c.footer?.copyright}</div>
        </div>
        <div className="border-t border-black/10 px-4 py-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-[#222]">
          <a href="/food/user/profile/privacy" className="hover:underline">Privacy Policy</a>
          <a href="/food/user/profile/terms" className="hover:underline">Terms &amp; Conditions</a>
        </div>
      </footer>
    </div>
  )
}

const ContactRow = ({ icon: Cmp, children }) => (
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: YELLOW }}>
      <Cmp className="w-4 h-4 text-[#111]" />
    </div>
    <div className="leading-snug">{children}</div>
  </div>
)

