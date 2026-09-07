import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Wallet,
  Tag,
  User,
  Leaf,
  Palette,
  Bookmark,
  Building2,
  Moon,
  Sun,
  Check,
  Percent,
  Info,
  PenSquare,
  AlertTriangle,
  Settings as SettingsIcon,
  Power,
  ShoppingCart,
  MapPin,
  Share2,
  Utensils,
  Trash2,
  Bell,
  Award,
} from "lucide-react";

import AnimatedPage from "@food/components/user/AnimatedPage";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { useProfile } from "@food/context/ProfileContext";
import { useLocationSelector } from "@food/components/user/UserLayout";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@food/components/ui/avatar";
import { useCompanyName } from "@food/hooks/useCompanyName";
import OptimizedImage from "@food/components/OptimizedImage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog";
import { authAPI, userAPI, notificationAPI } from "@food/api";
import { firebaseAuth } from "@food/firebase";
import { clearModuleAuth } from "@food/utils/auth";
import { toast } from "sonner";
const debugLog = (...args) => { };
const debugWarn = (...args) => { };
const debugError = (...args) => { };
const USER_SESSION_PREFERENCE_KEYS = ["userVegMode", "food-under-250-filters"];

import { registerWebPushForCurrentModule } from "@food/utils/firebaseMessaging";
import { useTheme } from "@food/context/ThemeContext";

const profilePageCache = {
  referralReward: null,
  walletBalance: null,
  loyaltyPoints: null
};

export default function Profile() {
  const { userProfile, vegMode, setVegMode, getDefaultAddress, addresses } =
    useProfile();
  const { openLocationSelector } = useLocationSelector();
  const navigate = useNavigate();
  const companyName = useCompanyName();
  const defaultAddress = getDefaultAddress?.();
  const savedAddressSummary = defaultAddress
    ? [
      defaultAddress.street,
      defaultAddress.additionalDetails,
      defaultAddress.city,
      defaultAddress.state,
      defaultAddress.zipCode,
    ]
      .filter(Boolean)
      .join(", ")
    : "No address saved. Tap to save Home, Work, or Other.";

  // Popup states
  const [vegModeOpen, setVegModeOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [referralReward, setReferralReward] = useState(() => profilePageCache.referralReward || 0);
  const [walletBalance, setWalletBalance] = useState(() => profilePageCache.walletBalance || 0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(() => profilePageCache.loyaltyPoints || 0);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteCaptcha, setDeleteCaptcha] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  // Trigger web push registration when profile mounts to ensure FCM token is saved
  useEffect(() => {
    registerWebPushForCurrentModule().catch(console.error);
  }, []);

  const handleVegModeUpdate = (nextValue) => {
    setVegMode(nextValue);
    localStorage.setItem("userVegMode", String(nextValue));
  };

  const { theme: appearance, setTheme: setAppearance } = useTheme();

  // Get first letter of name for avatar
  const avatarInitial =
    userProfile?.name?.charAt(0)?.toUpperCase() ||
    userProfile?.phone?.charAt(1)?.toUpperCase() ||
    "U";
  const displayName = userProfile?.name || userProfile?.phone || "User";
  // Only show email if it exists and is valid, otherwise show phone or "Not available"
  const hasValidEmail =
    userProfile?.email &&
    userProfile.email.trim() !== "" &&
    userProfile.email.includes("@");
  const displayEmail = hasValidEmail
    ? userProfile.email
    : userProfile?.phone || "Not available";

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    if (!userProfile) return 0;

    // Helper function to check if date field is filled (handles Date objects, date strings, ISO strings)
    const isDateFilled = (dateField) => {
      if (!dateField) return false;

      // Check if it's a Date object
      if (dateField instanceof Date) {
        return !isNaN(dateField.getTime());
      }

      // Check if it's a string
      if (typeof dateField === "string") {
        const trimmed = dateField.trim();
        if (trimmed === "" || trimmed === "null" || trimmed === "undefined")
          return false;

        // Try to parse as date (handles various formats: YYYY-MM-DD, ISO strings, etc.)
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          // Valid date
          return true;
        }
      }

      return false;
    };

    // Check name - must have value
    const hasName = !!(
      userProfile.name &&
      typeof userProfile.name === "string" &&
      userProfile.name.trim() !== ""
    );

    // Check contact - phone OR email (at least one)
    const hasPhone = !!(
      userProfile.phone &&
      typeof userProfile.phone === "string" &&
      userProfile.phone.trim() !== ""
    );
    const hasContact = hasPhone || hasValidEmail;

    // Check profile image - must have URL string
    const hasImage = !!(
      userProfile.profileImage &&
      typeof userProfile.profileImage === "string" &&
      userProfile.profileImage.trim() !== "" &&
      userProfile.profileImage !== "null" &&
      userProfile.profileImage !== "undefined"
    );

    // Check date of birth
    const hasDateOfBirth = isDateFilled(userProfile.dateOfBirth);

    // Check gender - must be valid value
    const validGenders = ["male", "female", "other", "prefer-not-to-say"];
    const hasGender = !!(
      userProfile.gender &&
      typeof userProfile.gender === "string" &&
      userProfile.gender.trim() !== "" &&
      validGenders.includes(userProfile.gender.trim().toLowerCase())
    );

    // Required fields only (anniversary is NOT counted - it's optional)
    // Only these 5 fields count towards 100%
    const requiredFields = {
      name: hasName,
      contact: hasContact,
      profileImage: hasImage,
      dateOfBirth: hasDateOfBirth,
      gender: hasGender,
    };

    const totalRequiredFields = 5; // Fixed: name, contact, profileImage, dateOfBirth, gender
    const completedRequiredFields =
      Object.values(requiredFields).filter(Boolean).length;

    // Calculate percentage based ONLY on required fields (anniversary NOT included)
    const percentage = Math.round(
      (completedRequiredFields / totalRequiredFields) * 100,
    );

    // Always log for debugging (remove in production if needed)
    debugLog("?? Profile completion check:", {
      requiredFields,
      completedRequiredFields,
      totalRequiredFields,
      percentage,
      fieldStatus: {
        name: hasName ? "?" : "?",
        contact: hasContact ? "?" : "?",
        profileImage: hasImage ? "?" : "?",
        dateOfBirth: hasDateOfBirth ? "?" : "?",
        gender: hasGender ? "?" : "?",
      },
      rawData: {
        name: userProfile.name || "missing",
        phone: userProfile.phone || "missing",
        email: userProfile.email || "missing",
        profileImage: userProfile.profileImage ? "exists" : "missing",
        dateOfBirth: userProfile.dateOfBirth
          ? String(userProfile.dateOfBirth)
          : "missing",
        gender: userProfile.gender || "missing",
      },
    });

    return percentage;
  };

  const profileCompletion = calculateProfileCompletion();
  const isComplete = profileCompletion === 100;
  useEffect(() => {
    if (profilePageCache.referralReward !== null) {
      return;
    }
    let mounted = true;
    userAPI
      .getReferralStats()
      .then((res) => {
        const reward = res?.data?.data?.stats?.rewardAmount;
        const finalReward = Number(reward) || 0;
        if (mounted) setReferralReward(finalReward);
        profilePageCache.referralReward = finalReward;
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (profilePageCache.walletBalance !== null) {
      return;
    }
    let mounted = true;
    userAPI
      .getWallet()
      .then((res) => {
        const w = res?.data?.data?.wallet || res?.data?.wallet;
        const bal = Number(w?.balance);
        const finalBal = Number.isFinite(bal) ? bal : 0;
        if (mounted) setWalletBalance(finalBal);
        profilePageCache.walletBalance = finalBal;
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (profilePageCache.loyaltyPoints !== null) {
      return;
    }
    let mounted = true;
    userAPI
      .getLoyaltyPoints()
      .then((res) => {
        const bal = Number(res?.data?.data?.balance);
        const finalBal = Number.isFinite(bal) ? bal : 0;
        if (mounted) setLoyaltyPoints(finalBal);
        profilePageCache.loyaltyPoints = finalBal;
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  const refId =
    userProfile?._id || userProfile?.id || userProfile?.referralCode || "";
  const referralLink = refId
    ? `${window.location.origin}/food/user/auth/login?ref=${encodeURIComponent(String(refId))}`
    : "";

  const handleShareReferral = async () => {
    if (!referralLink) return;
    const rewardText = referralReward > 0 ? `\u20B9${referralReward}` : "rewards";
    const shareText = `Join ${companyName} and earn ${rewardText}.`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${companyName} referral`,
          text: shareText,
          url: referralLink,
        });
      } else {
        const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralLink}`)}`;
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      debugError("Failed to share referral:", error);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks

    setIsLoggingOut(true);

    try {
      // Call backend logout API to invalidate refresh token
      try {
        let fcmToken = null;
        let voipToken = null;
        let platform = "web";
        let devicePlatform = "web";
        let deviceId = null;
        try {
          if (typeof window !== "undefined") {
            if (window.flutter_inappwebview) {
              platform = "mobile";
              const fcmHandlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
              for (const handlerName of fcmHandlerNames) {
                try {
                  const t = await Promise.race([
                    window.flutter_inappwebview.callHandler(handlerName, { module: "user" }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500))
                  ]);
                  if (t && typeof t === "string" && t.length > 20) {
                    fcmToken = t.trim();
                    break;
                  }
                } catch (e) {
                  console.warn(`Bridge handler ${handlerName} failed or timed out`, e);
                }
              }

              const platformHandlerNames = ["getDevicePlatform", "getPlatform", "getNativePlatform"];
              for (const handlerName of platformHandlerNames) {
                try {
                  const value = await Promise.race([
                    window.flutter_inappwebview.callHandler(handlerName, { module: "user" }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
                  ]);
                  const normalized = String(value || "").trim().toLowerCase();
                  if (["ios", "android", "web"].includes(normalized)) {
                    devicePlatform = normalized;
                    break;
                  }
                } catch (e) {
                  console.warn(`Platform bridge handler ${handlerName} failed or timed out`, e);
                }
              }

              if (devicePlatform === "ios") {
                const voipHandlerNames = ["getVoipToken", "getVOIPToken", "getPushKitToken"];
                for (const handlerName of voipHandlerNames) {
                  try {
                    const t = await Promise.race([
                      window.flutter_inappwebview.callHandler(handlerName, { module: "user" }),
                      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500))
                    ]);
                    if (t && typeof t === "string" && t.length > 20) {
                      voipToken = t.trim();
                      break;
                    }
                  } catch (e) {
                    console.warn(`VoIP bridge handler ${handlerName} failed or timed out`, e);
                  }
                }
              }

              if (!fcmToken) {
                fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
              }
            } else {
              fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
            }
          }
        } catch (e) {
          console.warn("Failed to get push tokens during logout", e);
        }

        const tokenSeed = String(voipToken || fcmToken || "").trim().slice(-16);
        deviceId = tokenSeed ? ["tuggo", "user", devicePlatform || "unknown", tokenSeed].join(":") : null;

        if (deviceId || fcmToken || voipToken) {
          try {
            await userAPI.removePushDevice({ deviceId, fcmToken, voipToken });
          } catch (e) {
            console.warn("Failed to remove push device directly", e);
          }
        }

        if (fcmToken) {
          try {
            await userAPI.removeFcmToken(fcmToken, { platform });
          } catch (e) {
            console.warn("Failed to remove FCM token directly", e);
          }
        }

        await authAPI.logout(null, fcmToken, platform)
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        debugWarn(
          "Logout API call failed, continuing with local cleanup:",
          apiError,
        );
      }

      // Sign out from Firebase if user logged in via Google
      try {
        const { signOut } = await import("firebase/auth");
        // Firebase Auth is lazy-initialized now; only attempt sign out if it was actually used
        if (firebaseAuth) {
           const currentUser = firebaseAuth.currentUser;
           if (currentUser) {
             await signOut(firebaseAuth);
           }
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        debugWarn(
          "Firebase logout failed, continuing with local cleanup:",
          firebaseError,
        );
      }

      // Clear user module authentication data using utility function
      clearModuleAuth("user");

      // Clear legacy token data for backward compatibility
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");
      localStorage.removeItem("cart");
      localStorage.removeItem("userOrders");
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event("userAuthChanged"));

      // Navigate to sign in page
      navigate("/user/auth/login", { replace: true });
    } catch (err) {
      // Even if there's an error, we should still clear local data and logout
      debugError("Error during logout:", err);

      // Clear local data anyway using utility function
      clearModuleAuth("user");

      // Clear legacy token data for backward compatibility
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");
      localStorage.removeItem("cart");
      localStorage.removeItem("userOrders");
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
      window.dispatchEvent(new Event("userAuthChanged"));

      // Still navigate to login page
      navigate("/user/auth/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogoutClick = () => {
    if (isLoggingOut) return;
    setLogoutConfirmOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await userAPI.deleteAccount();
      toast.success("Account deleted successfully");
      // Clear all local data
      clearModuleAuth("user");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");
      localStorage.removeItem("cart");
      USER_SESSION_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
      window.dispatchEvent(new Event("userAuthChanged"));
      navigate("/user/auth/login", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestNotification = async () => {
    if (isTestingNotification) return;
    setIsTestingNotification(true);
    try {
      let platform = "web";
      if (typeof window !== "undefined" && window.flutter_inappwebview) {
        platform = "mobile";
      }
      const response = await notificationAPI.sendTestNotification(platform, { contextModule: "user" });
      const details = response?.data?.data || {}
      const successCount = details?.successCount || 0
      const failureCount = details?.failureCount || 0
      
      console.log("[FCM Test Details]:", details)
      if (successCount > 0) {
        toast.success(`Test sent! Delivered: ${successCount}, Failed: ${failureCount}`)
      } else {
        toast.error(`Test failed to deliver. Delivered: 0, Failed: ${failureCount}`)
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to send test notification");
    } finally {
      setIsTestingNotification(false);
    }
  };

  return (
    <AnimatedPage className="min-h-screen bg-[#f8fafc] dark:bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 py-6 md:py-10 pb-24">
        {/* Header: Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/user">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white dark:bg-gray-800 shadow-xs border border-gray-200 dark:border-gray-700">
                <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              </Button>
            </Link>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">My Profile</h1>
          </div>
        </div>

        {/* Desktop Responsive Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: User Card & Quick Stats */}
          <div className="lg:col-span-4 space-y-4">
            {/* Profile Info Card */}
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xs border border-gray-100 dark:border-gray-800 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: 3 }}
                    transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
                    className="relative mb-3"
                  >
                    <Avatar className="h-24 w-24 bg-emerald-100 dark:bg-emerald-950 border-4 border-white dark:border-gray-800 shadow-md">
                      {userProfile?.profileImage && (
                        <AvatarImage
                          src={
                            userProfile.profileImage &&
                              userProfile.profileImage.trim()
                              ? userProfile.profileImage
                              : undefined
                          }
                          alt={displayName}
                        />
                      )}
                      <AvatarFallback className="bg-emerald-600 text-white text-3xl font-bold">
                        {avatarInitial}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
                    {displayName}
                  </h2>
                  
                  {hasValidEmail && (
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {userProfile.email}
                    </p>
                  )}
                  {userProfile?.phone && (
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/40 mb-3">
                      {userProfile.phone}
                    </p>
                  )}
                  
                  {/* Edit Profile Button */}
                  <Link to="/food/user/profile/edit" className="w-full mt-2">
                    <Button variant="outline" className="w-full rounded-xl border-gray-200 dark:border-gray-700 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-gray-800">
                      <PenSquare className="h-3.5 w-3.5" />
                      Edit Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Quick Wallet & Loyalty Card */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/user/wallet" className="block">
                <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-xs p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2 opacity-90">
                    <Wallet className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Wallet</span>
                  </div>
                  <div className="text-xl font-black">
                    {"\u20B9"}{Number(walletBalance || 0).toFixed(0)}
                  </div>
                </Card>
              </Link>
              <Link to="/user/loyalty-points" className="block">
                <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl shadow-xs p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2 opacity-90">
                    <Award className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Points</span>
                  </div>
                  <div className="text-xl font-black">
                    {Number(loyaltyPoints || 0)} Pts
                  </div>
                </Card>
              </Link>
            </div>
          </div>

          {/* Right Column: Account Sections */}
          <div className="lg:col-span-8 space-y-4">
          <Link to="/user/wallet" className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Wallet className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {companyName} Money
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-green-600 dark:text-green-400">
                      {"\u20B9"}{Number(walletBalance || 0).toFixed(0)}
                    </span>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to="/user/loyalty-points" className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Award className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Loyalty Points
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-orange-600 dark:text-orange-400">
                      {Number(loyaltyPoints || 0).toLocaleString("en-IN")}
                    </span>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to="/user/profile/coupons" className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Tag className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Your coupons
                    </span>
                  </div>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to="/user/cart" className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <ShoppingCart className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Your cart
                    </span>
                  </div>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to="/user/profile/refer-earn" className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
            <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <Tag className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Refer & Earn
                    </span>
                  </div>
                  {referralReward > 0 && (
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                      Earn {"\u20B9"}{referralReward}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Invite a friend. Reward is added to your wallet when they
                    sign up.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShareReferral();
                    }}
                    className="inline-flex items-center gap-1 text-xs text-primary font-medium ml-2 px-2 py-1 rounded-md"
                    disabled={!referralLink}>
                    <Share2 className="h-3.5 w-3.5" />
                    Refer
                  </button>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          </Link>

          <motion.div
            whileHover={{ x: 4, scale: 1.01 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
            <Card
              className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer"
              onClick={openLocationSelector}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <motion.div
                    className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    transition={{ duration: 0.3 }}>
                    <MapPin className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      Saved addresses
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {savedAddressSummary}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {addresses?.length || 0}
                  </span>
                  <motion.div
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <Link to="/user/profile/edit" className="block">
            <motion.div
              whileHover={{ x: 4, scale: 1.01 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="bg-gray-100 dark:bg-gray-800 rounded-full p-2"
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      transition={{ duration: 0.3 }}>
                      <User className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Your profile
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.span
                      className={`text-xs font-medium px-2 py-1 rounded transition-colors ${isComplete
                          ? "bg-primary text-white shadow-sm"
                          : "bg-[#7e386615] text-primary border border-primary/10"
                        }`}
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.2 }}>
                      {profileCompletion}% completed
                    </motion.span>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          {/* Right Column: Account Sections */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 1. Account & Preferences */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 shadow-xs border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="w-1.5 h-4 bg-emerald-600 rounded-full"></div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
                  Account & Preferences
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Link to="/user/wallet" className="block">
                  <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-gray-700 hover:bg-emerald-50/40 dark:hover:bg-gray-800/40 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">{companyName} Money</p>
                        <p className="text-xs text-gray-400">Balance & Top-up</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-600">{"\u20B9"}{Number(walletBalance || 0).toFixed(0)}</span>
                  </div>
                </Link>

                <Link to="/user/loyalty-points" className="block">
                  <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-amber-200 dark:hover:border-gray-700 hover:bg-amber-50/40 dark:hover:bg-gray-800/40 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-50 dark:bg-amber-950/60 p-2.5 rounded-xl text-amber-600 dark:text-amber-400">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">Loyalty Points</p>
                        <p className="text-xs text-gray-400">Rewards & Redeem</p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-amber-600">{Number(loyaltyPoints || 0)} Pts</span>
                  </div>
                </Link>

                <div 
                  onClick={() => setVegModeOpen(true)}
                  className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-gray-700 hover:bg-emerald-50/40 dark:hover:bg-gray-800/40 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400">
                      <Leaf className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">Veg Mode</p>
                      <p className="text-xs text-gray-400">Filter dietary preferences</p>
                    </div>
                  </div>
                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${vegMode ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{vegMode ? "ON" : "OFF"}</span>
                </div>

                <div 
                  onClick={() => setAppearanceOpen(true)}
                  className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-gray-700 hover:bg-emerald-50/40 dark:hover:bg-gray-800/40 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-50 dark:bg-purple-950/60 p-2.5 rounded-xl text-purple-600 dark:text-purple-400">
                      <Palette className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">Appearance</p>
                      <p className="text-xs text-gray-400">Theme mode</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-purple-600 capitalize">{appearance}</span>
                </div>
              </div>
            </div>

            {/* 2. Collections & Saved Data */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 shadow-xs border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="w-1.5 h-4 bg-emerald-600 rounded-full"></div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
                  Collections & Addresses
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Link to="/user/profile/favorites" className="block">
                  <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-gray-700 hover:bg-emerald-50/40 dark:hover:bg-gray-800/40 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-50 dark:bg-amber-950/60 p-2.5 rounded-xl text-amber-600 dark:text-amber-400">
                        <Bookmark className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">Your Collections</p>
                        <p className="text-xs text-gray-400">Saved dishes & restaurants</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>

                <div onClick={openLocationSelector} className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-gray-700 hover:bg-emerald-50/40 dark:hover:bg-gray-800/40 transition-all flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors truncate">Saved Addresses</p>
                      <p className="text-xs text-gray-400 truncate max-w-[150px]">{savedAddressSummary}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              </div>
            </div>

            {/* 3. Orders & Support */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 shadow-xs border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="w-1.5 h-4 bg-emerald-600 rounded-full"></div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
                  Orders & Support
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Link to="/user/orders" className="block">
                  <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-gray-700 hover:bg-emerald-50/40 dark:hover:bg-gray-800/40 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 dark:bg-blue-950/60 p-2.5 rounded-xl text-blue-600 dark:text-blue-400">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">Your Orders</p>
                        <p className="text-xs text-gray-400">View past food orders</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>

                <Link to="/user/profile/support" className="block">
                  <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-gray-700 hover:bg-emerald-50/40 dark:hover:bg-gray-800/40 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="bg-teal-50 dark:bg-teal-950/60 p-2.5 rounded-xl text-teal-600 dark:text-teal-400">
                        <SettingsIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">Help & Support</p>
                        <p className="text-xs text-gray-400">24/7 customer care</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              </div>
            </div>

            {/* 4. Account Actions */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 shadow-xs border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between gap-4">
                <Button
                  onClick={() => setLogoutConfirmOpen(true)}
                  disabled={isLoggingOut}
                  className="flex-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs h-11 flex items-center justify-center gap-2"
                >
                  <Power className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </Button>

                <Button
                  onClick={() => { setDeleteStep(1); setDeleteCaptcha(""); setDeleteAccountOpen(true); }}
                  variant="outline"
                  className="rounded-xl border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 font-bold text-xs h-11 flex items-center justify-center gap-2 px-5"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

      {/* Veg Mode Popup */}
      <Dialog open={vegModeOpen} onOpenChange={setVegModeOpen}>
        <DialogContent className="max-w-sm md:max-w-md lg:max-w-lg w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="text-lg font-bold text-gray-900">
              Veg Mode
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Filter restaurants and dishes based on your dietary preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-5 pb-5">
            <button
              onClick={() => {
                handleVegModeUpdate(true);
                setVegModeOpen(false);
              }}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${vegMode
                  ? "border-green-600 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
                }`}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${vegMode
                      ? "border-green-600 bg-green-600"
                      : "border-gray-300"
                    }`}>
                  {vegMode && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">
                    Veg Mode ON
                  </p>
                  <p className="text-xs text-gray-500">
                    Show only vegetarian options
                  </p>
                </div>
              </div>
              <Leaf
                className={`h-5 w-5 ${vegMode ? "text-green-600" : "text-gray-400"}`}
              />
            </button>
            <button
              onClick={() => {
                handleVegModeUpdate(false);
                setVegModeOpen(false);
              }}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${!vegMode
                  ? "border-secondary bg-[#fdfafc] dark:bg-[#3c0f3d]/10"
                  : "border-gray-200 dark:border-gray-800 bg-white hover:border-gray-300"
                }`}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!vegMode ? "border-secondary bg-secondary" : "border-gray-300"
                    }`}>
                  {!vegMode && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">
                    Veg Mode OFF
                  </p>
                  <p className="text-xs text-gray-500">Show all options</p>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation Popup */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1a1a] p-5 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Log out?
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to log out?
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setLogoutConfirmOpen(false)}
                disabled={isLoggingOut}
              >
                No
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl bg-secondary hover:bg-[#3c0f3d] text-white"
                onClick={() => {
                  setLogoutConfirmOpen(false);
                  handleLogout();
                }}
                disabled={isLoggingOut}
              >
                Yes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Appearance Popup */}
      <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <DialogContent className="max-w-sm md:max-w-md lg:max-w-lg w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
              Appearance
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              Choose your preferred theme
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-5 pb-5">
            <button
              onClick={() => {
                setAppearance("light");
                setAppearanceOpen(false);
              }}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${appearance === "light"
                  ? "border-primary bg-[#fdfafc] dark:border-[#b18da5] dark:bg-[#3c0f3d]/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${appearance === "light"
                    ? "border-primary bg-primary dark:border-[#b18da5] dark:bg-[#b18da5]"
                    : "border-gray-300 dark:border-gray-600"
                  }`}>
                {appearance === "light" && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
              <Sun className="h-5 w-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  Light
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Default light theme
                </p>
              </div>
            </button>
            <button
              onClick={() => {
                setAppearance("dark");
                setAppearanceOpen(false);
              }}
              className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${appearance === "dark"
                  ? "border-primary dark:border-[#b18da5] bg-[#fdfafc] dark:bg-[#3c0f3d]/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                }`}>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${appearance === "dark"
                    ? "border-primary bg-primary dark:border-[#b18da5] dark:bg-[#b18da5]"
                    : "border-gray-300 dark:border-gray-600"
                  }`}>
                {appearance === "dark" && (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
              <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  Dark
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Dark theme
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation */}
      {deleteAccountOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1a1a] shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

            {deleteStep === 1 && (
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-2.5">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Account?</h3>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3.5 mb-4 border border-red-100 dark:border-red-900/30">
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">⚠️ This action is permanent and cannot be undone!</p>
                  <ul className="text-xs text-red-500/80 dark:text-red-400/70 space-y-1.5">
                    <li>• Your profile, addresses, and preferences will be deleted</li>
                    <li>• Wallet balance will be forfeited</li>
                    <li>• Order history will be anonymized</li>
                    <li>• Referral rewards will be lost</li>
                    <li>• You can sign up again as a new user with the same number</li>
                  </ul>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setDeleteAccountOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white"
                    onClick={() => setDeleteStep(2)}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className="p-5">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirm Deletion</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Type <span className="font-bold text-red-500">DELETE MY ACCOUNT</span> to confirm.</p>
                <input
                  type="text"
                  value={deleteCaptcha}
                  onChange={(e) => setDeleteCaptcha(e.target.value)}
                  placeholder="Type here..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
                  autoFocus
                  autoComplete="off"
                />
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => { setDeleteStep(1); setDeleteCaptcha(""); }}>
                    Back
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={deleteCaptcha.trim() !== "DELETE MY ACCOUNT" || isDeleting}
                    onClick={handleDeleteAccount}>
                    {isDeleting ? "Deleting..." : "Delete Forever"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatedPage>
  );
}
