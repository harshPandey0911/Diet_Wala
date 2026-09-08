import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Crown, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Lock,
  PhoneCall
} from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";

export default function RestaurantMySubscription() {
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [availablePackages, setAvailablePackages] = useState([]);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const isSubActive = subscription && subscription.status === "active";

  useEffect(() => {
    if (!loading && !isSubActive) {
      toast.info("Aapke paas koi active subscription nahi hai.");
      navigate("/food/restaurant", { replace: true });
    }
  }, [loading, isSubActive, navigate]);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);

      // Load subscription packages defined dynamically by Admin
      const savedPkgs = localStorage.getItem("dietvala_subscription_packages");
      if (savedPkgs) {
        try {
          const parsed = JSON.parse(savedPkgs);
          setAvailablePackages(Array.isArray(parsed) ? parsed : []);
        } catch {
          setAvailablePackages([]);
        }
      } else {
        setAvailablePackages([]);
      }

      // Fetch active restaurant details & assigned subscription
      const res = await restaurantAPI.getCurrentRestaurant();
      const restData = res?.data?.data || res?.data?.restaurant || res?.data;
      setRestaurant(restData);

      const restId = restData?._id || restData?.id;

      // 1. Check if backend restaurant object has a subscription
      if (restData?.subscription && restData.subscription.status === "active") {
        setSubscription(restData.subscription);
      } else if (restId) {
        // 2. Check local storage assigned subscriptions
        const storedSubs = localStorage.getItem("dietvala_restaurant_subscriptions");
        if (storedSubs) {
          const parsedMap = JSON.parse(storedSubs);
          if (parsedMap[restId] && parsedMap[restId].status === "active") {
            setSubscription(parsedMap[restId]);
          } else {
            setSubscription(null);
          }
        } else {
          setSubscription(null);
        }
      } else {
        setSubscription(null);
      }
    } catch (err) {
      console.error("Error fetching restaurant info", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePlan = (pkg) => {
    if (!restaurant) {
      toast.error("Restaurant info not found");
      return;
    }

    const restId = restaurant._id || restaurant.id;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + Number(pkg.durationDays || 30));

    const newSub = {
      restaurantId: restId,
      restaurantName: restaurant.restaurantName || restaurant.name || "My Restaurant",
      packageId: pkg.id,
      packageName: pkg.name,
      price: pkg.price,
      durationDays: pkg.durationDays,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: "active",
      maxFoods: pkg.maxFoods,
      maxOrders: pkg.maxOrders,
      commissionRate: pkg.commissionRate,
      updatedAt: new Date().toISOString()
    };

    const storedSubs = localStorage.getItem("dietvala_restaurant_subscriptions");
    const currentMap = storedSubs ? JSON.parse(storedSubs) : {};
    const updatedMap = {
      ...currentMap,
      [restId]: newSub
    };

    localStorage.setItem("dietvala_restaurant_subscriptions", JSON.stringify(updatedMap));
    setSubscription(newSub);
    toast.success(`Subscribed to ${pkg.name} successfully!`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="font-bold text-sm">Loading subscription details...</p>
      </div>
    );
  }

  const daysLeft = subscription?.endDate
    ? Math.max(0, Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-6 rounded-3xl shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Crown className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Restaurant Subscription</h1>
          </div>
          <p className="text-sm text-gray-300">
            {isSubActive
              ? "View active plan details, validity, and features."
              : "No active subscription plan found."}
          </p>
        </div>

        {isSubActive && (
          <div className="flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/10">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-gray-300">Active Plan</p>
              <p className="text-sm font-black text-white">{subscription.packageName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Active Subscription Details */}
      {isSubActive ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">
                    {subscription.packageName}
                  </h2>
                  <Badge className="bg-emerald-100 text-emerald-800 font-extrabold border-emerald-300">
                    ACTIVE
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Valid until: {new Date(subscription.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-2xl font-black text-gray-900 dark:text-white">₹{subscription.price}</span>
              <p className="text-xs font-bold text-emerald-600">{daysLeft} Days Remaining</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {subscription.maxFoods && (
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-500 uppercase">Max Items</p>
                <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{subscription.maxFoods} Dishes</p>
              </div>
            )}
            {subscription.maxOrders && (
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-500 uppercase">Monthly Orders</p>
                <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{subscription.maxOrders} Orders</p>
              </div>
            )}
            {subscription.commissionRate !== undefined && (
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-500 uppercase">Platform Commission</p>
                <p className="text-lg font-black text-emerald-600 mt-1">{subscription.commissionRate}% Commission</p>
              </div>
            )}
          </div>
        </div>
      ) : availablePackages.length === 0 ? (
        /* Empty State: No Subscription & No Packages */
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-gray-100 dark:border-gray-800 shadow-sm text-center flex flex-col items-center justify-center space-y-4 min-h-[350px]">
          <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center border border-amber-200 dark:border-amber-900/50">
            <Lock className="w-8 h-8" />
          </div>

          <div className="max-w-md space-y-2">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">No Active Subscription</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Aapke restaurant ke paas abhi koi active subscription plan nahi hai. Naya plan activate karne ke liye Admin team se contact karein.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button
              onClick={fetchSubscriptionData}
              variant="outline"
              className="rounded-2xl font-bold text-xs flex items-center gap-2 border-gray-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>

            <Button
              onClick={() => toast.info("Please contact admin to enable a subscription plan for your outlet.")}
              className="rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Contact Admin</span>
            </Button>
          </div>
        </div>
      ) : null}

      {/* Available Plans Section (Only rendered if dynamic packages exist and vendor is choosing) */}
      {!isSubActive && availablePackages.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Available Subscription Plans
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePackages.map((pkg) => {
              return (
                <div 
                  key={pkg.id} 
                  className={`bg-white dark:bg-gray-900 p-6 rounded-3xl border relative flex flex-col justify-between transition-all duration-300 ${
                    pkg.popular ? "border-amber-400 shadow-md ring-2 ring-amber-400/30" : "border-gray-100 dark:border-gray-800"
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-3 right-6 bg-[#FFC700] text-gray-950 font-black text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                      Recommended
                    </span>
                  )}

                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">{pkg.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-gray-900 dark:text-white">₹{pkg.price}</span>
                      <span className="text-xs font-bold text-gray-400">/ {pkg.durationDays} Days</span>
                    </div>

                    {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                      <ul className="mt-5 space-y-2.5 border-t border-gray-100 dark:border-gray-800 pt-4">
                        {pkg.features.map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                            <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5" strokeWidth={3} />
                            </div>
                            {feat}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Button 
                      onClick={() => handleChoosePlan(pkg)}
                      className="w-full rounded-2xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>Choose Plan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
