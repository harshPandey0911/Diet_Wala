import { Link } from "react-router-dom"
import { X, ChevronRight, ShoppingCart } from "lucide-react"
import { useCart } from "@food/context/CartContext"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function StickyCartCard() {
  const { cart, getCartCount, clearCart } = useCart()
  const [isVisible, setIsVisible] = useState(true)
  const [bottomPosition, setBottomPosition] = useState("bottom-[70px]") // Fixed above bottom navigation
  const cartCount = getCartCount()

  // Set fixed position above bottom navigation (no scroll-based movement)
  useEffect(() => {
    // Set initial position based on screen size
    const setInitialPosition = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6") // Desktop: fixed position
      } else {
        setBottomPosition("bottom-[70px]") // Mobile: above bottom nav (fixed, doesn't move with scroll)
      }
    }

    setInitialPosition()

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6") // Desktop: always fixed
      } else {
        setBottomPosition("bottom-[70px]") // Mobile: above bottom nav (fixed)
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Get restaurant info from first cart item or use default
  const restaurantName = cart[0]?.restaurant || "Restaurant"
  const restaurantImage = cart[0]?.image || "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&h=200&fit=crop"

  // Create restaurant slug from restaurant name
  const restaurantSlug = restaurantName.toLowerCase().replace(/\s+/g, "-")

  // Calculate total price
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity * 83), 0)

  // Animation variants for the popout effect
  const cardVariants = {
    initial: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.8,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: 100,
      rotate: -5,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  }

  // Don't render if cart is empty
  if (cartCount === 0) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`fixed ${bottomPosition} md:bottom-8 right-4 md:right-6 z-50 flex justify-end pointer-events-none`}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={cardVariants}
        >
          <Link
            to="/user/cart"
            className="pointer-events-auto bg-primary hover:bg-primary/90 shadow-md shadow-primary/40 border border-white/20 text-primary-foreground rounded-full flex items-center justify-center p-3 transition-all transform hover:scale-105 active:scale-95 group relative"
          >
            <ShoppingCart className="h-6 w-6 text-primary-foreground" />
            <span className="absolute -top-1.5 -right-1.5 bg-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white dark:border-[#0a0a0a]">
              {cartCount}
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

