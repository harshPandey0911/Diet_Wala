import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Leaf, ChevronRight } from "lucide-react"
import api from "@food/api"
import { getThumbUrl, getMediaUrl } from "@/shared/utils/media.js"
import { WEBSITE_DEFAULTS } from "../../../../../app/website/websiteDefaults.js"
import { WEBSITE_ICONS } from "../../../../../app/website/websiteIcons.js"
import RestaurantImageCarousel from "./RestaurantImageCarousel"

/**
 * Website (computer / tablet) look of the user home: hero, why choose, menu, popular meals, how it works.
 * Shown from the md breakpoint up only - phones keep the existing home layout (see Home.jsx).
 * Categories, meals, restaurants, prices and banners are the real data of the app; only the headings and
 * short texts come from Admin > Website Content.
 */

const YELLOW = "#FFC400"
const GREEN = "#0B8A3E"
const CACHE_KEY = "dietvala_website_content_v2"

const Icon = ({ name, className, style }) => {
  const Cmp = WEBSITE_ICONS[name] || Leaf
  return <Cmp className={className} style={style} />
}

function useWebsiteContent() {
  const [content, setContent] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null")
      return cached && typeof cached === "object" ? cached : WEBSITE_DEFAULTS
    } catch {
      return WEBSITE_DEFAULTS
    }
  })
  useEffect(() => {
    let cancelled = false
    api.get("/food/website/public")
      .then((res) => {
        const data = res?.data?.data
        if (cancelled || !data || typeof data !== "object") return
        setContent(data)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* storage unavailable */ }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return content
}

const SectionTitle = ({ eyebrow, title, highlight, subtitle }) => (
  <div>
    {eyebrow ? (
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#E0A800]"><Leaf className="w-3.5 h-3.5" /> {eyebrow}</div>
    ) : null}
    <h2 className="mt-1 text-[28px] font-extrabold leading-[1.1] text-gray-900 dark:text-white">
      {title}
      {highlight ? <span className="block" style={{ color: GREEN }}>{highlight}</span> : null}
    </h2>
    {subtitle ? <p className="mt-2 text-[14px] text-gray-600 dark:text-gray-300">{subtitle}</p> : null}
  </div>
)

// Big picture on the right of the hero (edge to edge on wide screens). Uses the admin's banners and
// slides through them when there are several.
const HeroImage = ({ images, loading }) => {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    setIndex(0)
    if (images.length < 2) return undefined
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), 4000)
    return () => clearInterval(timer)
  }, [images])

  return (
    <div className="relative w-full aspect-[16/10] lg:aspect-auto lg:absolute lg:inset-y-0 lg:right-0 lg:w-[52%] bg-[#FFE066] overflow-hidden">
      {images.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={getThumbUrl(getMediaUrl(src), 1200)}
          alt=""
          fetchPriority={i === 0 ? "high" : "auto"}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {!images.length && loading ? <div className="absolute inset-0 animate-pulse bg-[#FFE066]" /> : null}
      <div className="hidden lg:block absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#FFFBEA] to-transparent" />
      {images.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/60"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

const CategoryPicture = ({ category }) => {
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative aspect-[4/3] shrink-0 bg-[#FFF8E1] flex items-center justify-center overflow-hidden">
      {category.image && !failed ? (
        <img
          src={getThumbUrl(getMediaUrl(category.image), 400)}
          alt={category.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <span className="text-4xl">{category.icon || "🥗"}</span>
      )}
    </div>
  )
}

export default function DesktopHomeSections({
  categories = [],
  restaurants = [],
  startingPriceByRestaurant = {},
  heroImages = [],
  heroBannersData = [],
  heroLoading = false,
  backendOrigin = "",
  slugifyCategory = (value) => String(value || "").toLowerCase().replace(/\s+/g, "-"),
}) {
  const c = useWebsiteContent()
  const hasBanner = heroLoading || heroImages.length > 0
  const popular = restaurants.slice(0, 8)

  const scrollToMenu = () => document.getElementById("dv-menu")?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <div className="hidden md:block font-sans">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#FFFBEA] dark:bg-[#14120a]">
        {hasBanner ? <HeroImage images={heroImages} loading={heroLoading} /> : null}
        <div className="relative max-w-[1240px] mx-auto px-6 py-14 lg:min-h-[480px] flex items-center pointer-events-none">
          <div className="lg:max-w-[52%] pointer-events-auto">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-gray-800 dark:text-gray-200">
              {(c.hero?.tags || []).map((tag, i) => (
                <span key={`${tag}-${i}`} className="flex items-center gap-3">
                  {i > 0 ? <span className="text-gray-400">|</span> : null}
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="mt-5 font-extrabold leading-[1.05] tracking-tight text-gray-900 dark:text-white text-[44px] xl:text-[54px]">
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
            <p className="mt-6 max-w-[470px] text-[16px] leading-relaxed text-gray-800 dark:text-gray-300">{c.hero?.description}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={scrollToMenu}
                className="inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[14px] font-bold text-white shadow-lg hover:brightness-110 transition"
                style={{ background: GREEN }}
              >
                {c.hero?.primaryCta} <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/food/user/under-250"
                className="inline-flex items-center rounded-full border-[1.5px] border-gray-900 dark:border-white px-7 py-3.5 text-[14px] font-bold text-gray-900 dark:text-white hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition"
              >
                {c.hero?.secondaryCta}
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-y-4 xl:flex-nowrap">
              {(c.hero?.highlights || []).map((item, i) => (
                <div key={`${item.title}-${i}`} className={`flex items-center gap-2 pr-3.5 ${i > 0 ? "pl-3.5 border-l border-black/15 dark:border-white/20" : ""}`}>
                  <Icon name={item.icon} className="w-6 h-6 shrink-0" style={{ color: GREEN }} />
                  <div className="text-[11px] leading-tight text-gray-800 dark:text-gray-200 whitespace-nowrap">
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
      {c.why?.visible !== false ? (
        <section className="bg-[#FFFBEA] dark:bg-[#14120a] border-t border-black/5 dark:border-white/5">
          <div className="max-w-[1240px] mx-auto px-6 py-10 grid lg:grid-cols-[250px_1fr] gap-8 items-center">
            <div>
              <h2 className="text-[30px] font-extrabold leading-[1.1] text-gray-900 dark:text-white">
                {c.why?.title}
                <span className="block" style={{ color: GREEN }}>{c.why?.highlight} <Leaf className="inline w-5 h-5 -mt-2" /></span>
              </h2>
              <p className="mt-3 text-[15px] text-gray-700 dark:text-gray-300">{c.why?.subtitle}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(c.why?.items || []).map((item, i) => (
                <div key={`${item.title}-${i}`} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-black/5 dark:border-white/10 shadow-sm px-4 py-6 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center" style={{ background: YELLOW }}>
                    <Icon name={item.icon} className="w-6 h-6 text-gray-900" />
                  </div>
                  <h3 className="mt-3 text-[15px] font-bold text-gray-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-[12px] leading-snug text-gray-600 dark:text-gray-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* OUR MENU: the real categories */}
      {c.menu?.visible !== false && categories.length > 0 ? (
        <section id="dv-menu" className="scroll-mt-44 bg-white dark:bg-[#0a0a0a]">
          <div className="max-w-[1240px] mx-auto px-6 py-10 grid lg:grid-cols-[250px_1fr] gap-8 items-center">
            <div>
              <SectionTitle eyebrow={c.menu?.eyebrow} title={c.menu?.title} highlight={c.menu?.highlight} subtitle={c.menu?.subtitle} />
              <Link
                to="/food/user/under-250"
                className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-gray-900 hover:brightness-105 transition"
                style={{ background: YELLOW }}
              >
                {c.menu?.ctaLabel} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-3">
              {categories.map((category, index) => {
                const slug = category.slug || slugifyCategory(category.name || "")
                return (
                  <Link
                    key={category.id || category.name || index}
                    to={slug === "all" ? "/food/user/under-250" : `/food/user/category/${slug}`}
                    className="group bg-white dark:bg-[#1a1a1a] rounded-xl border border-black/10 dark:border-white/10 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition"
                  >
                    <CategoryPicture category={category} />
                    <div className="px-3 py-3 text-center text-[13px] font-bold leading-tight text-gray-900 dark:text-white">{category.name}</div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* POPULAR: the real restaurants with their starting price */}
      {c.popular?.visible !== false && popular.length > 0 ? (
        <section className="bg-white dark:bg-[#0a0a0a]">
          <div className="max-w-[1240px] mx-auto px-6 pb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[24px] font-extrabold text-gray-900 dark:text-white">{c.popular?.title}</h2>
              <Link to="/food/user/under-250" className="inline-flex items-center gap-1 text-[13px] font-bold text-[#D97706] hover:underline">
                {c.popular?.ctaLabel} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
              {popular.map((restaurant, idx) => {
                const slug = restaurant.slug || (restaurant.name ? restaurant.name.toLowerCase().replace(/\s+/g, "-") : `res-${idx}`)
                const price = startingPriceByRestaurant[String(restaurant.mongoId || restaurant.id)]
                return (
                  <Link
                    key={restaurant.mongoId || restaurant.id || idx}
                    to={`/user/restaurants/${slug}`}
                    className="group bg-white dark:bg-[#161616] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden hover:shadow-md transition"
                  >
                    <div className="relative h-40 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      {restaurant.image ? (
                        <img src={getThumbUrl(restaurant.image, 400)} alt={restaurant.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <RestaurantImageCarousel restaurant={restaurant} backendOrigin={backendOrigin} className="h-40" roundedClass="rounded-t-2xl" />
                      )}
                    </div>
                    <div className="p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-[14px] text-gray-900 dark:text-white truncate">{restaurant.name}</h3>
                        <p className="text-[11px] font-semibold text-gray-500 truncate">
                          {Array.isArray(restaurant.cuisines) ? restaurant.cuisines.join(", ") : ""}
                        </p>
                      </div>
                      {price !== undefined ? <span className="text-[15px] font-black text-gray-900 dark:text-white shrink-0">₹{price}</span> : null}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* HOW IT WORKS */}
      {c.how?.visible !== false ? (
        <section className="bg-[#FFF8DC] dark:bg-[#14120a]">
          <div className="max-w-[1240px] mx-auto px-6 py-10">
            <h2 className="text-[26px] font-extrabold text-gray-900 dark:text-white">{c.how?.title}</h2>
            <p className="mt-1 text-[13px] text-gray-700 dark:text-gray-300">{c.how?.subtitle}</p>
            <div className="mt-6 grid grid-cols-2 xl:grid-cols-4 gap-6">
              {(c.how?.steps || []).map((step, i) => (
                <div key={`${step.title}-${i}`} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-extrabold text-gray-900" style={{ background: YELLOW }}>{i + 1}</span>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: GREEN }}>
                      <Icon name={step.icon} className="w-[18px] h-[18px]" />
                    </span>
                  </div>
                  <h3 className="mt-3 text-[14px] font-bold text-gray-900 dark:text-white">{step.title}</h3>
                  <p className="mt-1 text-[12px] leading-snug text-gray-700 dark:text-gray-400">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
