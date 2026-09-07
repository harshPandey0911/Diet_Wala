import { Link, useLocation } from "react-router-dom"
import { Home as HomeIcon, Utensils, ShoppingBag, User, ShoppingCart } from "lucide-react"
import { useCart } from "@food/context/CartContext"

export default function BottomNavigation() {
  const location = useLocation()
  const pathname = location.pathname
  const { totalItems } = useCart()

  // Check active routes
  const isHome =
    pathname === "/food" ||
    pathname === "/food/" ||
    pathname === "/food/user" ||
    pathname === "/food/user/"
  const isMeals = pathname.includes("/under-250") || pathname.includes("/categories") || pathname.includes("/category")
  const isOrders = pathname.includes("/orders")
  const isProfile = pathname.includes("/profile")

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#121212] z-50 shadow-[0_-2px_15px_rgba(0,0,0,0.06)] border-t border-gray-100 dark:border-gray-800/80 pb-[max(env(safe-area-inset-bottom,0px),4px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] box-border">
      <div className="flex items-center justify-around px-1 py-0.5 relative h-[48px]">
        {/* 1. Home Tab */}
        <Link
          to="/food/user/"
          className={`flex flex-col items-center justify-center gap-0.5 w-1/5 py-0.5 transition-colors ${
            isHome
              ? "text-[#D97706] dark:text-[#FFC700] font-bold"
              : "text-gray-400 dark:text-gray-500 font-medium hover:text-gray-700"
          }`}
        >
          <HomeIcon className={`h-4 w-4 ${isHome ? "text-[#D97706] dark:text-[#FFC700]" : "text-gray-400 dark:text-gray-500"}`} strokeWidth={isHome ? 2.5 : 2} />
          <span className="text-[9px] leading-none">Home</span>
        </Link>

        {/* 2. Meals Tab */}
        <Link
          to="/food/user/under-250"
          className={`flex flex-col items-center justify-center gap-0.5 w-1/5 py-0.5 transition-colors ${
            isMeals
              ? "text-[#D97706] dark:text-[#FFC700] font-bold"
              : "text-gray-400 dark:text-gray-500 font-medium hover:text-gray-700"
          }`}
        >
          <Utensils className={`h-4 w-4 ${isMeals ? "text-[#D97706] dark:text-[#FFC700]" : "text-gray-400 dark:text-gray-500"}`} strokeWidth={isMeals ? 2.5 : 2} />
          <span className="text-[9px] leading-none">Meals</span>
        </Link>

        {/* 3. Center Compact Floating Yellow Circle "Order" Button */}
        <div className="w-1/5 flex flex-col items-center justify-center relative">
          <Link
            to="/food/user/cart"
            className="absolute -top-4 w-11 h-11 rounded-full bg-[#FFC700] hover:bg-[#E6B800] text-black shadow-md border-3 border-white dark:border-[#121212] flex items-center justify-center active:scale-90 transition-transform"
          >
            <div className="relative flex items-center justify-center">
              <ShoppingCart className="h-4.5 w-4.5 text-black" strokeWidth={2.5} />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white">
                  {totalItems}
                </span>
              )}
            </div>
          </Link>
          <span className="text-[9px] font-bold text-gray-800 dark:text-gray-200 mt-4 leading-none">Order</span>
        </div>

        {/* 4. Orders Tab */}
        <Link
          to="/food/user/orders"
          className={`flex flex-col items-center justify-center gap-0.5 w-1/5 py-0.5 transition-colors ${
            isOrders
              ? "text-[#D97706] dark:text-[#FFC700] font-bold"
              : "text-gray-400 dark:text-gray-500 font-medium hover:text-gray-700"
          }`}
        >
          <ShoppingBag className={`h-4 w-4 ${isOrders ? "text-[#D97706] dark:text-[#FFC700]" : "text-gray-400 dark:text-gray-500"}`} strokeWidth={isOrders ? 2.5 : 2} />
          <span className="text-[9px] leading-none">Orders</span>
        </Link>

        {/* 5. Profile Tab */}
        <Link
          to="/food/user/profile"
          className={`flex flex-col items-center justify-center gap-0.5 w-1/5 py-0.5 transition-colors ${
            isProfile
              ? "text-[#D97706] dark:text-[#FFC700] font-bold"
              : "text-gray-400 dark:text-gray-500 font-medium hover:text-gray-700"
          }`}
        >
          <User className={`h-4 w-4 ${isProfile ? "text-[#D97706] dark:text-[#FFC700]" : "text-gray-400 dark:text-gray-500"}`} strokeWidth={isProfile ? 2.5 : 2} />
          <span className="text-[9px] leading-none">Profile</span>
        </Link>
      </div>
    </div>
  )
}
