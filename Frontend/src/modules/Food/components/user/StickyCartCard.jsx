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
        setBottomPosition("bottom-6")
      } else {
        setBottomPosition("bottom-[54px]")
      }
    }

    setInitialPosition()

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6")
      } else {
        setBottomPosition("bottom-[54px]")
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
          className={`fixed ${bottomPosition} md:bottom-8 right-3 md:right-6 z-50 flex justify-end pointer-events-none`}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={cardVariants}
        >
          <Link
            to="/user/cart"
            className="pointer-events-auto bg-[#FFC700] hover:bg-[#E6B800] shadow-md border border-black/10 text-black rounded-full flex items-center justify-center p-2.5 transition-all transform hover:scale-105 active:scale-95 group relative"
          >
            <ShoppingCart className="h-5 w-5 text-black" strokeWidth={2.5} />
            <span className="absolute -top-1 -right-1 bg-[#16A34A] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[16px] text-center border border-white">
              {cartCount}
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

