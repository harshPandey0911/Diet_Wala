import { Link, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef, useMemo } from "react"
import { ChevronDown, ShoppingCart, Wallet, Search, Mic } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Switch } from "@food/components/ui/switch"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useCart } from "@food/context/CartContext"
import { useLocationSelector, useSearchOverlay } from "./UserLayout"
import { useProfile } from "@food/context/ProfileContext"
import { FaLocationDot } from "react-icons/fa6"
import { AnimatePresence, motion } from "framer-motion"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"
import { getPublicLandingSettings } from "@food/api"
import { useAppLocation } from "@food/hooks/useAppLocation"
import { useAppLogo } from "@food/hooks/useAppLogo"
import DietValaLogo from "@/shared/components/DietValaLogo"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DesktopNavbar({ showLogo = true }) {
    const location = useLocation()
    const navigate = useNavigate()
    const { location: userLocation, loading: locationLoading } = useLocationHook()
    const { getCartCount } = useCart()
    const { openLocationSelector } = useLocationSelector()
    const { setSearchValue } = useSearchOverlay()
    const { vegMode, setVegMode } = useProfile()
    const { zoneId } = useAppLocation()
    const [heroSearch, setHeroSearch] = useState("")
    const logoUrl = useAppLogo('user_app')
    const [companyName, setCompanyName] = useState(null)
    const [hasScrolledPastBanner, setHasScrolledPastBanner] = useState(false)
    const [under250PriceLimit, setUnder250PriceLimit] = useState(250)
    const [showDining, setShowDining] = useState(true)
    const navRef = useRef(null)
    const cartCount = getCartCount()

    // Show area if available, otherwise show city
    const areaName = userLocation?.area && userLocation?.area.trim() ? userLocation.area.trim() : null
    const cityName = userLocation?.city || "Indore"
    const fullAddress = userLocation?.address || userLocation?.formattedAddress || ""
    
    // Main location name: Show area
    const mainLocationName = useMemo(() => {
        let name = areaName || "Select Location"
        if (/^-?\d+(\.\d+)?$/.test(name.trim())) {
            return "Current Location"
        }
        return name
    }, [areaName])
    
    // Middle location: Show full address (base address) - Cleaned up
    const baseAddress = useMemo(() => {
        let addr = fullAddress || ""
        if (cityName) {
            addr = addr.replace(new RegExp(`,?\\s*${cityName}\\s*`, 'gi'), '').trim()
        }
        if (areaName && areaName.length > 3) {
            addr = addr.replace(new RegExp(`^${areaName},?\\s*`, 'i'), '').trim()
        }
        if (/^-?\d+\.\d+,\s*-?\\s*\d+\.\d+$/.test(fullAddress.trim()) || /^-?\d+\.\d+,\s*-?\\s*\d+\.\d+$/.test(addr.trim()) || !addr || addr === ",") {
            return "Pinpoint location"
        }
        return addr
    }, [fullAddress, cityName, areaName])
    
    // Bottom location: Show city
    const bottomCity = cityName

    const handleLocationClick = () => {
        // Open location selector overlay
        openLocationSelector()
    }

    // Check active routes - support both /user/* and /* paths
    const isDining = location.pathname === "/food/user/dining" || location.pathname === "/food/dining"
    const isUnder250 = location.pathname === "/food/user/under-250" || location.pathname === "/food/under-250"
    const isProfile = location.pathname.startsWith("/food/user/profile") || location.pathname.startsWith("/food/profile")
    const isDelivery = !isDining && !isUnder250 && !isProfile && (location.pathname === "/food/user" || location.pathname === "/food" || (location.pathname.startsWith("/food/user") && !location.pathname.includes("/dining") && !location.pathname.includes("/under-250") && !location.pathname.includes("/profile")))
    const isBannerRoute =
        location.pathname === "/food/user" ||
        location.pathname === "/food" ||
        location.pathname === "/food/user/under-250" ||
        location.pathname === "/food/under-250"

    // Load business settings company name
    useEffect(() => {
        const loadName = async () => {
            try {
                const cached = getCachedSettings()
                if (cached?.companyName) {
                    setCompanyName(cached.companyName)
                } else {
                    const settings = await loadBusinessSettings()
                    if (settings?.companyName) {
                        setCompanyName(settings.companyName)
                    }
                }
            } catch (error) {
                debugError('Error loading company name:', error)
            }
        }
        loadName()

        // Listen for business settings updates
        const handleSettingsUpdate = () => {
            const cached = getCachedSettings()
            if (cached?.companyName) {
                setCompanyName(cached.companyName)
            }
        }
        window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)

        return () => {
            window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
        }
    }, [])

    useEffect(() => {
        if (!isBannerRoute) {
            setHasScrolledPastBanner(true)
            return
        }

        const handleScroll = () => {
            const heroShell =
                document.querySelector('[data-home-hero-shell="true"]') ||
                document.querySelector('[data-banner-shell="true"]')
            const navElement = navRef.current

            if (!heroShell || !navElement) {
                setHasScrolledPastBanner(false)
                return
            }

            const heroRect = heroShell.getBoundingClientRect()
            const navHeight = navElement.getBoundingClientRect().height || 0
            setHasScrolledPastBanner(heroRect.bottom <= navHeight)
        }

        handleScroll()
        window.addEventListener("scroll", handleScroll, { passive: true })
        window.addEventListener("resize", handleScroll)

        return () => {
            window.removeEventListener("scroll", handleScroll)
            window.removeEventListener("resize", handleScroll)
        }
    }, [isBannerRoute])

    // Fetch landing settings to get dynamic price limit
    useEffect(() => {
        let cancelled = false
        getPublicLandingSettings(zoneId || null)
            .then((settings) => {
                if (cancelled || !settings) return
                if (typeof settings.under250PriceLimit === 'number') {
                    setUnder250PriceLimit(settings.under250PriceLimit)
                }
                if (typeof settings.showDining === 'boolean') {
                    setShowDining(settings.showDining)
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setUnder250PriceLimit(250)
                    setShowDining(true)
                }
            })
        return () => { cancelled = true }
    }, [zoneId])

    return (
        <nav
            ref={navRef}
            className={`hidden md:flex flex-col fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                (isBannerRoute && !hasScrolledPastBanner)
                    ? "bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-amber-100/50 dark:border-gray-800 shadow-sm"
                    : "bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm"
            }`}
        >
            {/* Top Row: Location - Search - Icons */}
            <div className="w-full border-b border-gray-100 dark:border-gray-800/60 py-2">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14 gap-6">
                        {/* Left: Logo & Location */}
                        <div className="flex items-center gap-6 flex-shrink-0">
                            {/* Logo */}
                            {showLogo && (
                                <Link to="/food/user" className="flex items-center justify-center flex-shrink-0 hover:opacity-95 transition-opacity">
                                    <DietValaLogo size="md" showTagline={false} stacked={false} />
                                </Link>
                            )}

                            {/* Location Selector */}
                            <Button
                                variant="ghost"
                                onClick={handleLocationClick}
                                disabled={locationLoading}
                                className="h-auto px-3 py-1.5 rounded-xl hover:bg-amber-50/60 dark:hover:bg-gray-800/60 transition-all border border-transparent hover:border-amber-200/50 flex-shrink-0 group"
                            >
                                {locationLoading ? (
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                        Loading...
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0 border border-emerald-200/60 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                                            <FaLocationDot className="h-4 w-4" fill="currentColor" />
                                        </div>
                                        <div className="flex flex-col items-start min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100 whitespace-nowrap group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                                    {mainLocationName}
                                                </span>
                                                <ChevronDown className="h-3.5 w-3.5 text-gray-500 group-hover:translate-y-0.5 transition-transform" strokeWidth={2.5} />
                                            </div>
                                            {baseAddress && (
                                                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 truncate max-w-[180px]">
                                                    {baseAddress}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Button>
                        </div>

                        {/* Center: Search Bar & Veg Mode */}
                        <div className="flex-1 max-w-2xl flex items-center gap-4">
                            {/* Search Bar */}
                            <div className="relative flex-1">
                                <div className="relative bg-gray-50 dark:bg-gray-800/80 rounded-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:bg-white dark:focus-within:bg-gray-800 border border-gray-200/80 dark:border-gray-700/60 focus-within:border-emerald-500/40 shadow-2xs">
                                    <div className="flex items-center px-3.5 py-2">
                                        <Search className="h-4 w-4 text-gray-400 flex-shrink-0 mr-2.5" />
                                        <Input
                                            value={heroSearch}
                                            onChange={(e) => {
                                                const nextValue = e.target.value
                                                setHeroSearch(nextValue)
                                                setSearchValue(nextValue)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && heroSearch.trim()) {
                                                    navigate(`/food/search?q=${encodeURIComponent(heroSearch.trim())}`)
                                                }
                                            }}
                                            className="h-6 p-0 border-0 bg-transparent text-sm font-medium placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-800 dark:text-gray-100"
                                            placeholder="Search for restaurants, healthy meals..."
                                        />
                                        {heroSearch && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full ml-1"
                                                onClick={() => setHeroSearch("")}
                                            >
                                                <span className="sr-only">Clear</span>
                                                <span aria-hidden="true">✕</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* VEG MODE Toggle */}
                            <div className="flex items-center gap-2 flex-shrink-0 bg-emerald-50/60 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 leading-none tracking-tight">VEG</span>
                                    <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">ONLY</span>
                                </div>
                                <Switch
                                    checked={vegMode}
                                    onCheckedChange={setVegMode}
                                    className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-700 h-5 w-9"
                                />
                            </div>
                        </div>

                        {/* Right: Wallet and Cart Icons */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            {/* Wallet Icon */}
                            <Link to="/food/user/wallet">
                                <Button
                                    variant="ghost"
                                    className="h-10 w-10 rounded-xl p-0 bg-gray-50 dark:bg-gray-800/80 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-gray-800 border border-gray-200/80 dark:border-gray-700/60 transition-all text-gray-700 dark:text-gray-300"
                                    title="Wallet"
                                >
                                    <Wallet className="h-4 w-4" strokeWidth={2} />
                                </Button>
                            </Link>

                            {/* Cart Icon */}
                            <Link to="/food/user/cart">
                                <Button
                                    variant="ghost"
                                    className="relative h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-md transition-all flex items-center gap-2 font-bold text-xs"
                                    title="Cart"
                                >
                                    <ShoppingCart className="h-4 w-4" strokeWidth={2.2} />
                                    <span>Cart</span>
                                    {cartCount > 0 && (
                                        <span className="ml-0.5 px-1.5 py-0.5 bg-amber-400 text-gray-950 text-[10px] font-black rounded-full">
                                            {cartCount > 99 ? "99+" : cartCount}
                                        </span>
                                    )}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Navigation Tabs */}
            <div className={`w-full ${(isBannerRoute && !hasScrolledPastBanner) ? "bg-transparent" : "bg-white dark:bg-gray-900"}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-center h-10">
                        {/* Navigation Tabs - Centered with spacing */}
                        <div className="flex items-center space-x-16 lg:space-x-24">
                            {/* Delivery Tab */}
                            <Link
                                to="/food/user/"
                                className={`flex flex-col items-center gap-1 px-3 py-1 transition-all relative group ${isDelivery
                                    ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                                    : "text-gray-600 dark:text-gray-400 hover:text-emerald-600 font-bold"
                                    }`}
                            >
                                <span className="text-xs tracking-wider uppercase">Delivery</span>
                                {isDelivery && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>

                            {/* Under 250 Tab */}
                            <Link
                                to="/food/user/under-250"
                                className={`flex flex-col items-center gap-1 px-3 py-1 transition-all relative group ${isUnder250
                                    ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                                    : "text-gray-600 dark:text-gray-400 hover:text-emerald-600 font-bold"
                                    }`}
                            >
                                <span className="text-xs tracking-wider uppercase">Under ₹{under250PriceLimit}</span>
                                {isUnder250 && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>

                            {/* Dining Tab */}
                            {showDining && (
                                <Link
                                    to="/food/user/dining"
                                    className={`flex flex-col items-center gap-1 px-3 py-1 transition-all relative group ${isDining
                                        ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                                        : "text-gray-600 dark:text-gray-400 hover:text-emerald-600 font-bold"
                                        }`}
                                >
                                    <span className="text-xs tracking-wider uppercase">Dining</span>
                                    {isDining && (
                                        <motion.div
                                            layoutId="navIndicator"
                                            className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    )}
                                </Link>
                            )}

                            {/* Profile Tab */}
                            <Link
                                to="/food/user/profile"
                                className={`flex flex-col items-center gap-1 px-3 py-1 transition-all relative group ${isProfile
                                    ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
                                    : "text-gray-600 dark:text-gray-400 hover:text-emerald-600 font-bold"
                                    }`}
                            >
                                <span className="text-xs tracking-wider uppercase">Profile</span>
                                {isProfile && (
                                    <motion.div
                                        layoutId="navIndicator"
                                        className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}






