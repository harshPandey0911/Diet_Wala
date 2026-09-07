import { useState, useEffect } from "react";
import { 
  Crown, 
  Check, 
  Sparkles, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Lock,
  Building2
} from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";

const DEFAULT_PACKAGES = [
  {
    id: "pkg_basic",
    name: "Basic Plan",
    price: 999,
    durationDays: 30,
    maxFoods: 50,
    maxOrders: 300,
    commissionRate: 10,
    features: ["50 Menu Items", "300 Monthly Orders", "10% Platform Commission", "Basic Support"],
    popular: false,
    badgeColor: "bg-slate-100 text-slate-800"
  },
  {
    id: "pkg_pro",
    name: "Pro Growth Plan",
    price: 2499,
    durationDays: 30,
    maxFoods: 200,
    maxOrders: 1500,
    commissionRate: 5,
    features: ["200 Menu Items", "1500 Monthly Orders", "5% Platform Commission", "Priority Support", "Featured Listing"],
    popular: true,
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300"
  },
  {
    id: "pkg_enterprise",
    name: "Enterprise Unlimited",
    price: 4999,
    durationDays: 90,
    maxFoods: 9999,
    maxOrders: 99999,
    commissionRate: 0,
    features: ["Unlimited Menu Items", "Unlimited Orders", "0% Commission", "24/7 VIP Support", "Top Zone Banner Ad"],
    popular: false,
    badgeColor: "bg-emerald-100 text-emerald-900"
  }
];

export default function RestaurantMySubscription() {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [availablePackages, setAvailablePackages] = useState(DEFAULT_PACKAGES);

  useEffect(() => {
    // Load subscription packages defined by Admin
    const savedPkgs = localStorage.getItem("dietvala_subscription_packages");
    if (savedPkgs) {
      try {
        setAvailablePackages(JSON.parse(savedPkgs));
      } catch {
        setAvailablePackages(DEFAULT_PACKAGES);
      }
    }

    // Load active restaurant details & assigned subscription
    const fetchRestaurantInfo = async () => {
      try {
        setLoading(true);
        const res = await restaurantAPI.getCurrentRestaurant();
        const restData = res?.data?.data || res?.data?.restaurant || res?.data;
        setRestaurant(restData);

        const restId = restData?._id || restData?.id;
        if (restId) {
          const storedSubs = localStorage.getItem("dietvala_restaurant_subscriptions");
          if (storedSubs) {
            const parsedMap = JSON.parse(storedSubs);
            if (parsedMap[restId]) {
              setSubscription(parsedMap[restId]);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching restaurant info", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurantInfo();
  }, []);

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
      restaurantName: restaurant.name || restaurant.restaurantName || "My Restaurant",
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
      <div className="p-8 text-center text-gray-500 font-bold">
        Loading subscription plan details...
      </div>
    );
  }

  const isSubActive = subscription && subscription.status === "active";
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
            <h1 className="text-2xl font-black tracking-tight">My Restaurant Subscription</h1>
          </div>
          <p className="text-sm text-gray-300">
            View active plan benefits, limits, validity, or upgrade your membership tier.
          </p>
        </div>

        {isSubActive && (
          <div className="flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/10">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-gray-300">Active Membership</p>
              <p className="text-sm font-black text-white">{subscription.packageName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Active Subscription Status Dashboard */}
      {isSubActive ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
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
                  Valid until: {new Date(subscription.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-2xl font-black text-gray-900 dark:text-white">₹{subscription.price}</span>
              <p className="text-xs font-bold text-emerald-600">{daysLeft} Days Remaining</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <p className="text-xs font-bold text-gray-500 uppercase">Max Items</p>
              <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{subscription.maxFoods || 200} Dishes</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <p className="text-xs font-bold text-gray-500 uppercase">Monthly Orders</p>
              <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{subscription.maxOrders || 1500} Orders</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <p className="text-xs font-bold text-gray-500 uppercase">Platform Commission</p>
              <p className="text-lg font-black text-emerald-600 mt-1">{subscription.commissionRate}% Commission</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-3xl p-6 text-amber-900 dark:text-amber-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-extrabold text-base">No Active Subscription Plan</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Choose a plan below to activate your outlet catalog and accept incoming customer orders.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Available Plans Section */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          Available Subscription Plans
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {availablePackages.map((pkg) => {
            const isCurrent = subscription?.packageId === pkg.id && isSubActive;
            return (
              <div 
                key={pkg.id} 
                className={`bg-white dark:bg-gray-900 p-6 rounded-3xl border relative flex flex-col justify-between transition-all duration-300 ${
                  pkg.popular ? "border-amber-400 shadow-md ring-2 ring-amber-400/30" : "border-gray-100 dark:border-gray-800"
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 right-6 bg-[#FFC700] text-gray-950 font-black text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                    Recommended Tier
                  </span>
                )}

                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">{pkg.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 dark:text-white">₹{pkg.price}</span>
                    <span className="text-xs font-bold text-gray-400">/ {pkg.durationDays} Days</span>
                  </div>

                  <ul className="mt-5 space-y-2.5 border-t border-gray-100 dark:border-gray-800 pt-4">
                    {pkg.features?.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </div>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {isCurrent ? (
                    <Button disabled className="w-full rounded-2xl font-black text-xs bg-emerald-100 text-emerald-800 cursor-default">
                      Current Active Plan
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleChoosePlan(pkg)}
                      className="w-full rounded-2xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-2"
                    >
                      <span>Choose Plan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
