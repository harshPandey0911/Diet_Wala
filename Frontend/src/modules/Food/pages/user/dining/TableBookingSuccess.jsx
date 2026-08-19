import { useLocation, useNavigate } from "react-router-dom"
import { CheckCircle2, Calendar, Clock, Users, MapPin, Home, List, Info, Store } from "lucide-react"
import { Button } from "@food/components/ui/button"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { useEffect, useState } from "react"

export default function TableBookingSuccess() {
    const location = useLocation()
    const navigate = useNavigate()
    const { booking } = location.state || {}
    const [imgError, setImgError] = useState(false)

    useEffect(() => {
        // Trigger confetti on mount
        const duration = 2.5 * 1000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 22, spread: 360, ticks: 45, zIndex: 0 }

        const randomInRange = (min, max) => Math.random() * (max - min) + min

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now()

            if (timeLeft <= 0) {
                return clearInterval(interval)
            }

            const particleCount = 35 * (timeLeft / duration)
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
        }, 320)

        return () => clearInterval(interval)
    }, [])

    if (!booking) {
        navigate("/food/user/dining")
        return null
    }

    const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

    return (
        <AnimatedPage className="bg-[#FAF9F6] dark:bg-slate-950 min-h-screen flex flex-col items-center justify-start p-3 pb-8 transition-colors overflow-y-auto">
            
            {/* Header Icon */}
            <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`w-11 h-11 ${booking.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-green-50 dark:bg-emerald-950/20'} rounded-full flex items-center justify-center mt-2 mb-2 transition-colors`}
            >
                {booking.status === 'pending' ? (
                    <Clock className="w-6.5 h-6.5 text-amber-500" />
                ) : (
                    <CheckCircle2 className="w-6.5 h-6.5 text-emerald-500" />
                )}
            </motion.div>

            {/* Request Message */}
            <motion.div
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-center space-y-1 mb-4"
            >
                <h1 className="text-[19px] font-bold text-gray-900 dark:text-slate-100 leading-tight">
                    {booking.status === 'pending' ? 'Booking Requested!' : 'Seat Confirmed!'}
                </h1>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium tracking-wide italic">
                    {booking.status === 'pending' ? 'Waiting for restaurant approval' : 'Your table is ready for you'}
                </p>
                <div className="pt-0.5">
                    <span className="bg-white dark:bg-slate-900 text-primary dark:text-purple-400 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-primary/20 dark:border-purple-400/20">
                        BOOKING ID: {booking.bookingId}
                    </span>
                </div>

                {booking.status === 'pending' && (
                    <div className="mt-3 mx-auto max-w-[310px] bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-2.5 text-left flex gap-2 shadow-sm transition-colors">
                        <div className="bg-amber-100 dark:bg-amber-900/40 p-1.5 rounded-lg h-fit shrink-0">
                            <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="font-bold text-amber-900 dark:text-amber-300 text-[10px]">Waiting for Confirmation</p>
                            <p className="text-amber-700 dark:text-amber-400/80 text-[8.5px] mt-0.5 leading-normal">
                                The restaurant will review and approve your request shortly. You'll be notified of the status.
                            </p>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Ticket Card */}
            <motion.div
                initial={{ y: 25, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="w-full max-w-[320px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-md transition-colors mt-1"
            >
                <div className="p-3.5 space-y-3.5 relative">
                    {/* Circle cutouts for ticket look */}
                    <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#FAF9F6] dark:bg-slate-950 rounded-full border border-slate-100 dark:border-slate-800 transition-colors"></div>
                    <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#FAF9F6] dark:bg-slate-950 rounded-full border border-slate-100 dark:border-slate-800 transition-colors"></div>

                    {/* Restaurant Info Header */}
                    <div className="flex items-center gap-2.5 text-left">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex-shrink-0 p-0.5 flex items-center justify-center overflow-hidden">
                            {!imgError && (booking.restaurant?.image || booking.restaurant?.profileImage?.url) ? (
                                <img
                                    src={booking.restaurant?.image || booking.restaurant?.profileImage?.url}
                                    className="w-full h-full object-cover rounded-lg"
                                    alt="restaurant"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <Store className="w-4.5 h-4.5 text-slate-400" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-bold text-[13px] text-gray-900 dark:text-slate-100 truncate">
                                {booking.restaurant?.name || "The Great fudron Restaurant"}
                            </h2>
                            <p className="text-[9px] text-gray-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">
                                    {typeof booking.restaurant?.location === 'string'
                                        ? booking.restaurant.location
                                        : (booking.restaurant?.location?.formattedAddress || booking.restaurant?.location?.address || `${booking.restaurant?.location?.city || ''}`)}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Booking Details Grid */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2 py-3 border-y border-dashed border-slate-200 dark:border-slate-800 text-left">
                        <div className="space-y-0.5">
                            <p className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Date</p>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-800 dark:text-slate-200">
                                <Calendar className="w-3 h-3 text-red-500" />
                                <span>{formattedDate}</span>
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Time</p>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-800 dark:text-slate-200">
                                <Clock className="w-3 h-3 text-red-500" />
                                <span>{booking.timeSlot}</span>
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Guests</p>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-800 dark:text-slate-200">
                                <Users className="w-3 h-3 text-red-500" />
                                <span>{booking.guests} People</span>
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Status</p>
                            <div className={`${booking.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'} px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider w-fit uppercase`}>
                                {booking.status === 'pending' ? 'PENDING' : 'CONFIRMED'}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="mt-4 w-full max-w-[320px] space-y-2"
            >
                <Button
                    onClick={() => navigate("/food/user/bookings")}
                    className="w-full h-[38px] bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-md shadow-red-200 dark:shadow-none flex items-center justify-center gap-1.5"
                >
                    <List className="w-3.5 h-3.5" />
                    View My Bookings
                </Button>
                <Button
                    onClick={() => navigate("/food/user")}
                    variant="outline"
                    className="w-full h-[38px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
                >
                    <Home className="w-3.5 h-3.5" />
                    Go to Home
                </Button>
            </motion.div>

            {/* Note text in normal flow to avoid overlap */}
            <p className="mt-5 text-[8.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest max-w-[260px] text-center leading-normal">
                Show this ticket at the restaurant for a smooth entry
            </p>
        </AnimatedPage>
    )
}
