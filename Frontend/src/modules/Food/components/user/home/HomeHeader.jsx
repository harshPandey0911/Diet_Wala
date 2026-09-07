import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronDown, Search, Mic, Bell, CheckCircle2, Tag, Gift, AlertCircle, BellOff, Menu, Pencil } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@food/components/ui/popover";
import { Badge } from "@food/components/ui/badge";
import useNotificationInbox from "@food/hooks/useNotificationInbox";
import DietValaLogo from "@/shared/components/DietValaLogo";

const ICON_MAP = {
  CheckCircle2,
  Tag,
  Gift,
  AlertCircle
};

export default function HomeHeader({
  activeTab,
  setActiveTab,
  location,
  savedAddressText,
  handleLocationClick,
  handleSearchFocus,
  placeholderIndex,
  placeholders,
  vegMode = false,
  handleVegModeChange,
  isCategoryStuck = false,
  handleVoiceSearchClick
}) {
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('food_user_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    dismiss: dismissBroadcastNotification,
  } = useNotificationInbox("user", { limit: 20 });

  useEffect(() => {
    const syncNotifications = () => {
      const saved = localStorage.getItem('food_user_notifications');
      setNotifications(saved ? JSON.parse(saved) : []);
    };

    window.addEventListener('notificationsUpdated', syncNotifications);
    return () => window.removeEventListener('notificationsUpdated', syncNotifications);
  }, []);

  const mergedNotifications = useMemo(() => {
    const localItems = Array.isArray(notifications)
      ? notifications.map((item) => ({ ...item, source: "local" }))
      : [];
    const broadcastItems = (broadcastNotifications || []).map((item) => ({
      ...item,
      source: "broadcast",
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        : "Just now",
      type: "broadcast",
      icon: "Bell",
      iconColor: "text-amber-500",
    }));

    return [...broadcastItems, ...localItems].sort(
      (a, b) =>
        new Date(b.createdAt || b.timestamp || 0).getTime() -
        new Date(a.createdAt || a.timestamp || 0).getTime()
    );
  }, [broadcastNotifications, notifications]);

  const unreadCount = notifications.filter(n => !n.read).length + broadcastUnreadCount;

  const areaName = (() => {
    const area = location?.area || location?.subLocality || location?.mainTitle || location?.neighborhood;
    const city = (location?.city || "").toLowerCase();
    const state = (location?.state || "").toLowerCase();

    if (area && !/^-?\d+(\.\d+)?$/.test(area.trim())) {
      const areaLower = area.toLowerCase();
      if (areaLower !== city && areaLower !== state) {
        return area;
      }
    }
    
    if (location?.address && location.address !== "Select location") {
      const parts = location.address.split(',').map(p => p.trim());
      for (const part of parts) {
        const partLower = part.toLowerCase();
        if (partLower && 
            partLower !== city && 
            partLower !== state && 
            !/^-?\d/.test(part) &&
            part.length > 2) {
          return part;
        }
      }
    }
    
    return location?.area || location?.city || "Mustafabad, Delhi";
  })();

  return (
    <>
      <div id="home-header-loc-row" className="relative pt-0.5 pb-2 px-3.5 transition-all duration-500 bg-[#FFFBEB] dark:bg-[#18150c] md:hidden">
        <div className="relative z-10 space-y-2">
          
          {/* Row 1: Top Navigation - Menu Icon, DietVala Logo & Tagline, Bell Notification Icon */}
          <div className="flex items-center justify-between gap-2 pb-0.5 pt-0.5">
            {/* Left: White Circle Hamburger Menu Icon */}
            <button 
              type="button" 
              className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 shadow-2xs border border-gray-100 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-800 dark:text-gray-200 active:scale-95 flex-shrink-0 -mt-1"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" strokeWidth={2.5} />
            </button>

            {/* Center: DietVala Branding Logo */}
            <Link to="/food/user/" className="flex flex-col items-center justify-center group flex-1">
              <DietValaLogo size="lg" showTagline={true} stacked={true} />
            </Link>

            {/* Right: White Circle Notification Bell */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="w-8 h-8 relative flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-2xs border border-gray-100 dark:border-gray-700 cursor-pointer active:scale-95 transition-all text-gray-800 dark:text-gray-200 flex-shrink-0 -mt-1">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#16A34A] border border-white dark:border-gray-900 animate-pulse" />
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 overflow-hidden border-none shadow-2xl rounded-2xl mt-2" align="end">
                <div className="bg-white dark:bg-gray-900">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-amber-50/50 dark:bg-gray-800/50">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      Notifications
                      {unreadCount > 0 && (
                        <Badge variant="secondary" className="bg-[#FFC700] text-black border-none text-[10px] h-4 font-bold">
                          {unreadCount} New
                        </Badge>
                      )}
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {mergedNotifications.length > 0 ? (
                      mergedNotifications.slice(0, 5).map((notif) => {
                        const Icon = ICON_MAP[notif.icon] || Bell;
                        return (
                          <div key={notif.id} className="p-4 flex items-start gap-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 transition-colors">
                            <div className="mt-1 p-2 rounded-full bg-amber-100 text-[#D97706]">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{notif.title}</p>
                               <p className="text-xs text-gray-500 line-clamp-1">{notif.message}</p>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center gap-2">
                        <BellOff className="h-10 w-10 text-gray-300" />
                        <p className="text-xs text-gray-400 font-medium">All caught up!</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 text-center">
                    <Link to="/food/user/notifications" className="text-xs font-bold text-gray-500 hover:text-gray-900">View All</Link>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Row 2: Delivering To Address Row with Green Pin & Yellow Change Button */}
          <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#141414] p-1.5 px-3 rounded-2xl border border-gray-200/70 dark:border-gray-800 shadow-2xs">
            <div
              className="flex items-center gap-2 cursor-pointer group min-w-0 flex-1"
              onClick={handleLocationClick}
            >
              {/* Green Location Pin Icon Circle */}
              <div className="w-7 h-7 rounded-full bg-[#16A34A] flex items-center justify-center flex-shrink-0 shadow-2xs">
                <MapPin className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-[9.5px] font-semibold text-gray-500 dark:text-gray-400 leading-none">
                  Delivering to
                </span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className="text-xs font-bold text-gray-900 dark:text-white truncate tracking-tight">
                    {areaName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300 flex-shrink-0" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Change Button - Bright Yellow Pill */}
            <button
              type="button"
              onClick={handleLocationClick}
              className="bg-[#FFC700] hover:bg-[#E6B800] active:scale-95 text-black font-extrabold text-[10px] px-3 py-1 rounded-full shadow-2xs flex items-center gap-1 flex-shrink-0 transition-transform"
            >
              Change
              <Pencil className="h-2.5 w-2.5" strokeWidth={2.5} />
            </button>
          </div>

        </div>
      </div>

      {/* Sticky Search Bar and Veg Toggle */}
      <div id="home-header-search-row" className={`relative sticky z-[60] px-3 pb-1 transition-all duration-300 pointer-events-none mt-0.5 md:hidden ${isCategoryStuck ? 'top-0 pt-1 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-2xl border-b border-gray-100 dark:border-gray-800' : 'top-0.5 pt-1 bg-transparent'}`}>
        <div className="flex items-center gap-1.5 w-full pointer-events-auto">
          {/* Search Bar */}
          <div
            className="relative bg-gray-50 dark:bg-[#1a1a1a] rounded-xl flex items-center px-2.5 shadow-2xs border border-gray-200 dark:border-gray-800 cursor-pointer active:scale-[0.99] transition-all duration-200 flex-1 h-8"
            onClick={handleSearchFocus}
          >
            <Search className="h-3.5 w-3.5 text-gray-400 mr-1.5 shrink-0" strokeWidth={2.5} />
            
            <div className="flex-1 overflow-hidden relative h-3.5">
              <AnimatePresence mode="wait">
                <motion.span
                  key={placeholderIndex}
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -5, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 text-[11px] font-medium text-gray-400 truncate flex items-center"
                >
                  {placeholders?.[placeholderIndex] || 'Search healthy meals, bowls...'}
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-1 pl-1">
              <div className="h-3.5 w-[1px] bg-gray-200 dark:bg-gray-700" />
              <Mic 
                className="h-3.5 w-3.5 text-gray-500 hover:text-[#16A34A] transition-colors" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoiceSearchClick?.();
                }}
              />
            </div>
          </div>

          {/* Veg Toggle (Pill Switch) */}
          <div 
            className="flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform duration-300 shrink-0 px-1.5 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl py-0.5 border border-gray-200 dark:border-gray-800 shadow-2xs h-8"
            onClick={() => handleVegModeChange?.(!vegMode)}
          >
            <div className="text-[7.5px] font-black leading-none text-emerald-800 dark:text-emerald-400 tracking-tight text-center mb-0.5">
              VEG MODE
            </div>
            <div className={`w-[22px] h-[12px] rounded-full relative transition-colors duration-300 border border-emerald-600/30 ${vegMode ? 'bg-[#16A34A]' : 'bg-gray-300 dark:bg-gray-700'}`}>
              <div className={`absolute top-[1px] w-[8px] h-[8px] rounded-full bg-white shadow-xs transition-transform duration-300 ${vegMode ? 'translate-x-[11px]' : 'translate-x-[1px]'}`} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

