import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { HeroBannerSkeleton } from "@food/components/ui/loading-skeletons";

const AUTO_SLIDE_MS = 3500;
const FADE_MS = 1000;

// Default DietVala Banner image fallback
const DIETVALA_BOWL_IMG = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

export default function HeroBanner({
  images = [],
  bannersData = [],
  loading = false,
  shellRef,
}) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoSlideIntervalRef = useRef(null);
  const isSwiping = useRef(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);

  useEffect(() => {
    setCurrentIndex((previous) => {
      if (images.length === 0) return 0;
      return Math.min(previous, images.length - 1);
    });
  }, [images.length]);

  const startAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) {
      clearInterval(autoSlideIntervalRef.current);
    }
    if (images.length <= 1) return;

    autoSlideIntervalRef.current = setInterval(() => {
      if (document.hidden || isSwiping.current) return;
      setCurrentIndex((previous) => (previous + 1) % images.length);
    }, AUTO_SLIDE_MS);
  }, [images.length]);

  useEffect(() => {
    startAutoSlide();
    return () => {
      if (autoSlideIntervalRef.current) {
        clearInterval(autoSlideIntervalRef.current);
      }
    };
  }, [startAutoSlide]);

  const resetAutoSlide = useCallback(() => {
    startAutoSlide();
  }, [startAutoSlide]);

  const goToPrevious = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((previous) => (previous - 1 + images.length) % images.length);
    resetAutoSlide();
  }, [images.length, resetAutoSlide]);

  const goToNext = useCallback(() => {
    if (images.length === 0) return;
    setCurrentIndex((previous) => (previous + 1) % images.length);
    resetAutoSlide();
  }, [images.length, resetAutoSlide]);

  const handleTouchStart = (event) => {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    isSwiping.current = true;
  };

  const handleTouchMove = (event) => {
    touchEndX.current = event.touches[0].clientX;
    touchEndY.current = event.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) return;

    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    const minSwipeDistance = 50;

    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaX) > deltaY) {
      if (deltaX > 0) goToPrevious();
      else goToNext();
    }

    setTimeout(() => {
      isSwiping.current = false;
    }, 300);

    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };

  if (loading) {
    return (
      <div className="px-4 py-2">
        <HeroBannerSkeleton className="w-full aspect-[21/9] rounded-3xl" />
      </div>
    );
  }

  // Display custom admin images if provided, otherwise render default DietVala Hero Banner Card
  const hasCustomImages = images && images.length > 0;

  return (
    <div className="px-4 py-2">
      <div
        ref={shellRef}
        data-home-hero-shell="true"
        className="relative w-full overflow-hidden rounded-3xl shadow-md group cursor-pointer bg-gradient-to-r from-[#FFC700] via-[#FFD233] to-[#FFB700]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (hasCustomImages) {
            const bannerData = bannersData[currentIndex];
            const linkedRestaurants = bannerData?.linkedRestaurants || [];
            if (linkedRestaurants.length > 0) {
              const firstRestaurant = linkedRestaurants[0];
              const restaurantSlug =
                firstRestaurant.slug ||
                firstRestaurant.restaurantId ||
                firstRestaurant._id;
              navigate(`/restaurants/${restaurantSlug}`);
              return;
            }
          }
          navigate('/food/user/under-250');
        }}
      >
        {hasCustomImages ? (
          <div className="relative z-0 w-full h-[170px] sm:h-[210px] md:h-[240px] flex items-center justify-center overflow-hidden rounded-3xl">
            {/* Render ONLY the single active slide to prevent multiple banner stacking */}
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={images[currentIndex % images.length]}
                alt={`Hero Banner ${currentIndex + 1}`}
                className="w-full h-full object-cover rounded-3xl"
                loading="eager"
                draggable={false}
              />
            </div>
          </div>
        ) : (
          /* DietVala Signature Banner Design */
          <div className="relative z-10 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3 h-[170px] sm:h-[210px] md:h-[240px]">
            {/* Left Content */}
            <div className="flex-1 space-y-1 sm:space-y-1.5 z-10 min-w-0">
              <h2 className="text-base xs:text-lg sm:text-2xl font-black text-gray-900 leading-tight tracking-tight">
                Healthy khana,<br />
                <span className="text-emerald-900">Better life!</span>
              </h2>
              <div className="text-[10px] sm:text-xs font-bold text-amber-950/85 leading-tight space-y-0.5">
                <p>• Clean meals. • Real results.</p>
                <p>• Delivered to your door.</p>
              </div>
              <div className="pt-1 sm:pt-2">
                <button
                  type="button"
                  className="bg-[#1E1E1E] hover:bg-black text-white font-extrabold text-[10px] sm:text-xs px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  Order Now
                  <div className="w-4 h-4 rounded-full bg-[#FFC700] text-black flex items-center justify-center">
                    <ArrowRight className="w-2.5 h-2.5" strokeWidth={3} />
                  </div>
                </button>
              </div>
            </div>

            {/* Right Food Dish Image */}
            <div className="relative w-24 h-24 sm:w-36 sm:h-36 md:w-44 md:h-44 flex-shrink-0">
              <div className="absolute inset-0 bg-black/10 rounded-full blur-xs transform translate-y-0.5 scale-90" />
              <img
                src={DIETVALA_BOWL_IMG}
                alt="DietVala Healthy Meal"
                className="w-full h-full object-cover rounded-full border-2 sm:border-3 border-white/80 shadow-md relative z-10 transform rotate-2 hover:rotate-0 transition-transform duration-500"
              />
            </div>
          </div>
        )}

        {/* Carousel Pagination Dots */}
        {hasCustomImages && images.length > 1 && (
          <div className="absolute bottom-1.5 left-4 z-30 flex gap-1 pointer-events-none">
            {images.map((_, dotIndex) => (
              <span
                key={`dot-${dotIndex}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  dotIndex === currentIndex
                    ? "w-3 bg-[#16A34A]"
                    : "w-1.5 bg-[#FFE28A]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

