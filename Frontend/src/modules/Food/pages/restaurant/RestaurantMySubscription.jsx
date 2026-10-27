import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  Check,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Lock,
  PhoneCall,
  MapPin,
} from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";
import { getSupportPhone, getSupportPhoneAsync } from "@food/utils/businessSettings";

const STATUS_META = {
  active: { label: "ACTIVE", className: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
  inactive: { label: "INACTIVE", className: "bg-rose-100 text-rose-800 border-rose-300", icon: "text-rose-600 bg-rose-50 dark:bg-rose-950/50" },
  expired: { label: "EXPIRED", className: "bg-amber-100 text-amber-800 border-amber-300", icon: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" },
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function RestaurantMySubscription() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [supportPhone, setSupportPhone] = useState(() => getSupportPhone("restaurant"));

  const fetchSubscriptionData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await restaurantAPI.getMySubscription();
      const payload = res?.data?.data || null;
      if (payload && payload.enabled === false) {
        toast.info("Aapke zone me subscription abhi available nahi hai.");
        navigate("/food/restaurant", { replace: true });
        return;
      }
      setData(payload);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchSubscriptionData();
    getSupportPhoneAsync("restaurant").then((phone) => {
      if (phone) setSupportPhone(phone);
    });
  }, [fetchSubscriptionData]);

  const handleContactAdmin = () => {
    if (supportPhone) {
      window.location.href = `tel:${String(supportPhone).replace(/[^\d+]/g, "")}`;
    } else {
      toast.info("Plan activate karne ke liye admin team se contact karein.");
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="font-bold text-sm">Loading subscription details...</p>
      </div>
    );
  }

  const subscription = data?.subscription || null;
  const packages = data?.packages || [];
  const isSubActive = subscription?.status === "active";
  const meta = subscription ? STATUS_META[subscription.status] || STATUS_META.inactive : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-6 rounded-3xl shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Crown className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Restaurant Subscription</h1>
          </div>
          <p className="text-sm text-gray-300 flex items-center gap-1.5">
            {data?.zoneName && (
              <>
                <MapPin className="w-3.5 h-3.5" /> {data.zoneName} •{" "}
              </>
            )}
            {isSubActive ? "View your active plan, validity and features." : "No active subscription plan."}
          </p>
        </div>

        {isSubActive && (
          <div className="flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-gray-300">Active Plan</p>
              <p className="text-sm font-black text-white">{subscription.packageName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Current plan */}
      {subscription ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${meta.icon}`}>
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">{subscription.packageName}</h2>
                  <Badge className={`font-extrabold ${meta.className}`}>{meta.label}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {subscription.status === "expired" ? "Expired on" : "Valid until"}: {formatDate(subscription.endDate)}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-2xl font-black text-gray-900 dark:text-white">₹{subscription.price}</span>
              <p className={`text-xs font-bold ${isSubActive ? "text-emerald-600" : "text-rose-600"}`}>
                {isSubActive
                  ? `${subscription.daysLeft} Days Remaining`
                  : subscription.status === "expired"
                    ? "Plan expired – renew karne ke liye admin se contact karein"
                    : "Plan paused by admin"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {subscription.maxFoods > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-500 uppercase">Max Items</p>
                <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{subscription.maxFoods} Dishes</p>
              </div>
            )}
            {subscription.maxOrders > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-500 uppercase">Monthly Orders</p>
                <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{subscription.maxOrders} Orders</p>
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <p className="text-xs font-bold text-gray-500 uppercase">Platform Commission</p>
              <p className="text-lg font-black text-emerald-600 mt-1">{subscription.commissionRate || 0}% Commission</p>
            </div>
          </div>

          {subscription.features?.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {subscription.features.map((feat, idx) => (
                <li key={idx} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  {feat}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 border border-gray-100 dark:border-gray-800 shadow-sm text-center flex flex-col items-center justify-center space-y-4 min-h-[260px]">
          <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center border border-amber-200 dark:border-amber-900/50">
            <Lock className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">No Subscription Yet</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Aapke restaurant ke paas abhi koi plan nahi hai. Neeche diye plans me se koi bhi activate karwane ke liye admin team se contact karein.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={fetchSubscriptionData}
          variant="outline"
          className="rounded-2xl font-bold text-xs flex items-center gap-2 border-gray-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
        {!isSubActive && (
          <Button
            onClick={handleContactAdmin}
            className="rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{supportPhone ? `Contact Admin (${supportPhone})` : "Contact Admin"}</span>
          </Button>
        )}
      </div>

      {/* Plans available in this restaurant's zone */}
      {packages.length > 0 && (
        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {data?.zoneName ? `Plans in ${data.zoneName}` : "Available Plans"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const isCurrent = subscription?.packageId === pkg._id && isSubActive;
              return (
                <div
                  key={pkg._id}
                  className={`bg-white dark:bg-gray-900 p-6 rounded-3xl border relative flex flex-col justify-between ${
                    isCurrent ? "border-emerald-400 ring-2 ring-emerald-400/30" : "border-gray-100 dark:border-gray-800"
                  }`}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 right-6 bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full">
                      Current Plan
                    </span>
                  )}
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">{pkg.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-gray-900 dark:text-white">₹{pkg.price}</span>
                      <span className="text-xs font-bold text-gray-400">/ {pkg.durationDays} Days</span>
                    </div>
                    {pkg.features?.length > 0 && (
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
                  {!isCurrent && (
                    <p className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500">
                      Ye plan lene ke liye admin se contact karein.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
