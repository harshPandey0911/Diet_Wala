import { useState, useEffect, useMemo } from "react";
import { 
  Building2, 
  Search, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  RefreshCw, 
  Check, 
  Filter, 
  Crown,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  PackageCheck
} from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import { Badge } from "@food/components/ui/badge";
import { adminAPI } from "@food/api";
import { toast } from "sonner";

// Initial fallback subscription packages if none exist
const INITIAL_PACKAGES = [];

export default function RestaurantSubscriptions() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'active', 'inactive', 'none'
  const [subscriptionsMap, setSubscriptionsMap] = useState({});
  
  // Dynamic Packages State
  const [packages, setPackages] = useState(() => {
    const savedPkgs = localStorage.getItem("dietvala_subscription_packages");
    return savedPkgs ? JSON.parse(savedPkgs) : [];
  });
  
  // Assign/Edit Subscription Modal state
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [customDurationDays, setCustomDurationDays] = useState(30);
  const [customPrice, setCustomPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [isAddPackageModalOpen, setIsAddPackageModalOpen] = useState(false);
  const [newPkgData, setNewPkgData] = useState({
    name: "",
    price: 1999,
    durationDays: 30,
    maxFoods: 100,
    maxOrders: 500,
    commissionRate: 5,
    featuresText: "100 Menu Items, 500 Orders, Priority Support"
  });

  const savePackages = (newPkgs) => {
    setPackages(newPkgs);
    localStorage.setItem("dietvala_subscription_packages", JSON.stringify(newPkgs));
  };

  const handleCreatePackage = (e) => {
    e.preventDefault();
    if (!newPkgData.name.trim()) {
      toast.error("Please enter a package name");
      return;
    }
    const created = {
      id: `pkg_${Date.now()}`,
      name: newPkgData.name,
      price: Number(newPkgData.price),
      durationDays: Number(newPkgData.durationDays),
      maxFoods: Number(newPkgData.maxFoods),
      maxOrders: Number(newPkgData.maxOrders),
      commissionRate: Number(newPkgData.commissionRate),
      features: newPkgData.featuresText.split(",").map(f => f.trim()).filter(Boolean),
      popular: false,
      badgeColor: "bg-amber-100 text-amber-900 border-amber-300"
    };
    const updated = [...packages, created];
    savePackages(updated);
    setIsAddPackageModalOpen(false);
    setNewPkgData({ name: "", price: 1999, durationDays: 30, maxFoods: 100, maxOrders: 500, commissionRate: 5, featuresText: "100 Menu Items, 500 Orders" });
    toast.success(`Package "${created.name}" created successfully!`);
  };

  // Load restaurants & subscriptions from localStorage / API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        const res = await adminAPI.getRestaurants({ page: 1, limit: 200 });
        const list = res?.data?.data?.restaurants || res?.data?.restaurants || [];
        setRestaurants(list);

        // Load stored subscriptions map
        const storedSubs = localStorage.getItem("dietvala_restaurant_subscriptions");
        if (storedSubs) {
          try {
            setSubscriptionsMap(JSON.parse(storedSubs));
          } catch {
            setSubscriptionsMap({});
          }
        }
      } catch (err) {
        console.error("Failed to load restaurants for subscriptions", err);
        toast.error("Failed to load restaurants");
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Save subscription map to local persistence
  const saveSubscriptions = (newMap) => {
    setSubscriptionsMap(newMap);
    localStorage.setItem("dietvala_restaurant_subscriptions", JSON.stringify(newMap));
  };

  // Toggle active/inactive subscription status
  const toggleSubscriptionStatus = (restaurantId) => {
    const current = subscriptionsMap[restaurantId];
    if (!current) {
      toast.error("No active subscription plan assigned yet");
      return;
    }

    const updatedStatus = current.status === "active" ? "inactive" : "active";
    const updatedMap = {
      ...subscriptionsMap,
      [restaurantId]: {
        ...current,
        status: updatedStatus,
        updatedAt: new Date().toISOString()
      }
    };

    saveSubscriptions(updatedMap);
    toast.success(`Subscription marked as ${updatedStatus.toUpperCase()}`);
  };

  // Open modal to assign plan
  const handleOpenAssignModal = (restaurant) => {
    setSelectedRestaurant(restaurant);
    const existing = subscriptionsMap[restaurant._id || restaurant.id];
    const defaultPkg = packages[0];

    if (existing) {
      setSelectedPackageId(existing.packageId || (defaultPkg ? defaultPkg.id : ""));
      setCustomDurationDays(existing.durationDays || (defaultPkg ? defaultPkg.durationDays : 30));
      setCustomPrice(existing.price || (defaultPkg ? defaultPkg.price : 0));
    } else if (defaultPkg) {
      setSelectedPackageId(defaultPkg.id);
      setCustomDurationDays(defaultPkg.durationDays);
      setCustomPrice(defaultPkg.price);
    } else {
      setSelectedPackageId("");
      setCustomDurationDays(30);
      setCustomPrice(0);
    }
    setIsAssignModalOpen(true);
  };

  // Assign or Renew plan submission
  const handleAssignSubscription = (e) => {
    e.preventDefault();
    if (!selectedRestaurant) return;

    setSubmitting(true);

    const targetPkg = packages.find(p => p.id === selectedPackageId) || {
      id: "custom",
      name: "Custom Plan",
      durationDays: Number(customDurationDays || 30),
      price: Number(customPrice || 0),
      maxFoods: 100,
      maxOrders: 500,
      commissionRate: 5
    };
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + Number(customDurationDays || targetPkg.durationDays || 30));

    const restId = selectedRestaurant._id || selectedRestaurant.id;
    const subscriptionData = {
      restaurantId: restId,
      restaurantName: selectedRestaurant.name || selectedRestaurant.restaurantName,
      packageId: targetPkg.id,
      packageName: targetPkg.name,
      price: Number(customPrice !== undefined ? customPrice : targetPkg.price),
      durationDays: Number(customDurationDays || targetPkg.durationDays),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: "active",
      maxFoods: targetPkg.maxFoods || 100,
      maxOrders: targetPkg.maxOrders || 500,
      commissionRate: targetPkg.commissionRate || 5,
      updatedAt: new Date().toISOString()
    };

    const updatedMap = {
      ...subscriptionsMap,
      [restId]: subscriptionData
    };

    saveSubscriptions(updatedMap);
    setSubmitting(false);
    setIsAssignModalOpen(false);
    toast.success(`Subscription assigned successfully to ${subscriptionData.restaurantName}`);
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return restaurants.filter((r) => {
      const restId = r._id || r.id;
      const sub = subscriptionsMap[restId];
      const nameMatch = (r.name || r.restaurantName || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.email || "").toLowerCase().includes(search.toLowerCase());

      if (!nameMatch) return false;

      if (statusFilter === "active") return sub?.status === "active";
      if (statusFilter === "inactive") return sub?.status === "inactive";
      if (statusFilter === "none") return !sub;
      return true;
    });
  }, [restaurants, subscriptionsMap, search, statusFilter]);

  // Overall Stats
  const stats = useMemo(() => {
    let activeCount = 0;
    let inactiveCount = 0;
    let totalRevenue = 0;

    Object.values(subscriptionsMap).forEach((sub) => {
      if (sub.status === "active") activeCount++;
      if (sub.status === "inactive") inactiveCount++;
      totalRevenue += Number(sub.price || 0);
    });

    return {
      total: restaurants.length,
      active: activeCount,
      inactive: inactiveCount,
      revenue: totalRevenue
    };
  }, [restaurants, subscriptionsMap]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706]">
              <Crown className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Restaurant Subscriptions
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage restaurant plans, pricing, active/inactive status and membership renewals.
          </p>
        </div>
        <Button
          onClick={() => setIsAddPackageModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Package
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Restaurants</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Plans</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
          <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Inactive / Paused</p>
          <p className="text-2xl font-black text-rose-500 mt-1">{stats.inactive}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Subscription Revenue</p>
          <p className="text-2xl font-black text-amber-600 mt-1">₹{stats.revenue.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Package Cards Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Active Subscription Tiers & Plans
          </h2>
        </div>
        {packages.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No subscription packages created yet</p>
            <p className="text-xs text-gray-400">Click "+ Create New Package" above to define your custom tier pricing and limits.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div 
                key={pkg.id} 
                className={`bg-white dark:bg-gray-900 p-5 rounded-2xl border relative flex flex-col justify-between ${
                  pkg.popular ? "border-amber-400 ring-2 ring-amber-400/20 shadow-md" : "border-gray-100 dark:border-gray-800 shadow-2xs"
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 right-4 bg-amber-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                    Most Popular
                  </span>
                )}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-base">{pkg.name}</h3>
                    <Badge className={pkg.badgeColor || "bg-amber-100 text-amber-900"}>{pkg.durationDays} Days</Badge>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 dark:text-white">₹{pkg.price}</span>
                    <span className="text-xs text-gray-500">/ {pkg.durationDays} days</span>
                  </div>
                  <ul className="space-y-1.5 pt-2">
                    {(pkg.features || []).map((feat, idx) => (
                      <li key={idx} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              placeholder="Search restaurant..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-9 bg-gray-50 dark:bg-gray-800 border-none rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="rounded-xl text-xs"
            >
              All ({restaurants.length})
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("active")}
              className="rounded-xl text-xs text-emerald-600"
            >
              Active ({stats.active})
            </Button>
            <Button
              variant={statusFilter === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("inactive")}
              className="rounded-xl text-xs text-rose-600"
            >
              Inactive ({stats.inactive})
            </Button>
            <Button
              variant={statusFilter === "none" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("none")}
              className="rounded-xl text-xs text-gray-600"
            >
              No Plan ({restaurants.length - stats.active - stats.inactive})
            </Button>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-[11px] font-black uppercase text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="p-4">Restaurant</th>
                <th className="p-4">Current Plan</th>
                <th className="p-4">Validity</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    Loading restaurant subscription details...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No restaurants found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredList.map((restaurant) => {
                  const restId = restaurant._id || restaurant.id;
                  const sub = subscriptionsMap[restId];
                  const isActive = sub?.status === "active";
                  const restName = restaurant.name || restaurant.restaurantName || "Unnamed Restaurant";

                  return (
                    <tr key={restId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 flex items-center justify-center font-black flex-shrink-0">
                            {restName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{restName}</p>
                            <p className="text-[11px] text-gray-400">{restaurant.email || restaurant.phone || "Partner"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        {sub ? (
                          <div>
                            <span className="font-extrabold text-gray-800 dark:text-gray-200">{sub.packageName}</span>
                            <p className="text-[10px] text-gray-400">₹{sub.price} ({sub.durationDays} Days)</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No Subscription</span>
                        )}
                      </td>

                      <td className="p-4">
                        {sub?.endDate ? (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>Until {new Date(sub.endDate).toLocaleDateString("en-IN")}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="p-4">
                        {sub ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSubscriptionStatus(restId)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"
                              }`}
                              title={isActive ? "Click to deactivate" : "Click to activate"}
                            >
                              <span
                                className={`pointer-events-[#none] inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  isActive ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <Badge className={isActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
                              {isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Unassigned</Badge>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleOpenAssignModal(restaurant)}
                          className="bg-[#1E1E1E] hover:bg-black text-white font-bold text-xs rounded-xl px-3"
                        >
                          {sub ? "Renew / Upgrade" : "Assign Plan"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign / Renew Plan Modal */}
      {isAssignModalOpen && selectedRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Assign Subscription
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedRestaurant.name || selectedRestaurant.restaurantName}
                </p>
              </div>
              <button 
                onClick={() => setIsAssignModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubscription} className="space-y-4">
              {/* Select Package */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Select Plan Package</label>
                <div className="grid grid-cols-3 gap-2">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => {
                        setSelectedPackageId(pkg.id);
                        setCustomDurationDays(pkg.durationDays);
                        setCustomPrice(pkg.price);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedPackageId === pkg.id 
                          ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20" 
                          : "border-gray-100 dark:border-gray-800 hover:border-gray-200"
                      }`}
                    >
                      <p className="font-extrabold text-xs text-gray-900 dark:text-white">{pkg.name}</p>
                      <p className="text-sm font-black text-amber-600 mt-1">₹{pkg.price}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Duration & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Duration (Days)</label>
                  <Input
                    type="number"
                    value={customDurationDays}
                    onChange={(e) => setCustomDurationDays(e.target.value)}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Subscription Fee (₹)</label>
                  <Input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#1E1E1E] hover:bg-black text-white font-extrabold text-xs rounded-xl px-5"
                >
                  {submitting ? "Saving..." : "Confirm Subscription"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New Subscription Package */}
      {isAddPackageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    Create New Subscription Package
                  </h3>
                  <p className="text-xs text-gray-500">Define custom tier pricing and feature limits</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddPackageModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Package Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Gold Booster Plan"
                  value={newPkgData.name}
                  onChange={(e) => setNewPkgData({...newPkgData, name: e.target.value})}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Price (₹)</label>
                  <Input
                    type="number"
                    value={newPkgData.price}
                    onChange={(e) => setNewPkgData({...newPkgData, price: e.target.value})}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Validity (Days)</label>
                  <Input
                    type="number"
                    value={newPkgData.durationDays}
                    onChange={(e) => setNewPkgData({...newPkgData, durationDays: e.target.value})}
                    className="rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Max Foods</label>
                  <Input
                    type="number"
                    value={newPkgData.maxFoods}
                    onChange={(e) => setNewPkgData({...newPkgData, maxFoods: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Max Orders</label>
                  <Input
                    type="number"
                    value={newPkgData.maxOrders}
                    onChange={(e) => setNewPkgData({...newPkgData, maxOrders: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Commission %</label>
                  <Input
                    type="number"
                    value={newPkgData.commissionRate}
                    onChange={(e) => setNewPkgData({...newPkgData, commissionRate: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Key Features (Comma Separated)</label>
                <Input
                  type="text"
                  placeholder="Feature 1, Feature 2, Feature 3"
                  value={newPkgData.featuresText}
                  onChange={(e) => setNewPkgData({...newPkgData, featuresText: e.target.value})}
                  className="rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddPackageModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl px-5"
                >
                  Create Package
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
