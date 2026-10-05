import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  Sparkles,
  Calendar,
  Check,
  Crown,
  MapPin,
  Pencil,
  Trash2,
  RefreshCw,
  Power,
} from "lucide-react";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import { Badge } from "@food/components/ui/badge";
import { adminAPI } from "@food/api";
import { toast } from "sonner";

const EMPTY_PACKAGE_FORM = {
  name: "",
  price: 1999,
  durationDays: 30,
  maxFoods: 100,
  maxOrders: 500,
  commissionRate: 5,
  featuresText: "",
  isActive: true,
  zonePrices: {}, // { [zoneId]: "price" } - empty means default price
};

const STATUS_BADGE = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
  inactive: { label: "Inactive", className: "bg-rose-100 text-rose-800" },
  expired: { label: "Expired", className: "bg-amber-100 text-amber-800" },
};

// Backend errors come as { error } from the global error handler, or { message } from sendError.
const getErrorMessage = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback;

const formatINR = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const getZonePrice = (pkg, zoneId) => {
  const override = (pkg?.zonePrices || []).find((zp) => String(zp.zoneId) === String(zoneId));
  return override ? Number(override.price) : Number(pkg?.price || 0);
};

function Toggle({ checked, onClick, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function RestaurantSubscriptions() {
  const [zones, setZones] = useState([]);
  const [packages, setPackages] = useState([]);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, expired: 0, none: 0, activeValue: 0 });
  const [loading, setLoading] = useState(true);

  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [zoneBusyId, setZoneBusyId] = useState(null);
  const [rowBusyId, setRowBusyId] = useState(null);

  // Package create/edit modal: null when closed
  const [packageModal, setPackageModal] = useState(null);
  const [packageForm, setPackageForm] = useState(EMPTY_PACKAGE_FORM);

  // Assign/renew modal
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignForm, setAssignForm] = useState({ packageId: "", durationDays: "", price: "", notes: "" });

  const [saving, setSaving] = useState(false);

  const zoneNameById = useMemo(
    () => Object.fromEntries(zones.map((z) => [z.zoneId, z.name])),
    [zones]
  );

  const loadZones = useCallback(async () => {
    try {
      const res = await adminAPI.getSubscriptionZones();
      setZones(res?.data?.data?.zones || []);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load zones"));
    }
  }, []);

  const loadPackages = useCallback(async () => {
    try {
      const res = await adminAPI.getSubscriptionPackages();
      setPackages(res?.data?.data?.packages || []);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load packages"));
    }
  }, []);

  const loadRestaurants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getRestaurantSubscriptions({
        zoneId: zoneFilter,
        status: statusFilter,
        search: debouncedSearch || undefined,
      });
      const data = res?.data?.data || {};
      setRows(data.restaurants || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load restaurant subscriptions"));
    } finally {
      setLoading(false);
    }
  }, [zoneFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    loadZones();
    loadPackages();
  }, [loadZones, loadPackages]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  // ---------- Zone toggle ----------
  const handleToggleZone = async (zone) => {
    const next = !zone.subscriptionEnabled;
    if (
      !next &&
      !window.confirm(
        `"${zone.name}" zone me subscription band karna hai?\n\nIs zone ke restaurants ko naya plan assign nahi hoga aur unhe "My Subscription" menu nahi dikhega.`
      )
    ) {
      return;
    }
    try {
      setZoneBusyId(zone.zoneId);
      await adminAPI.setSubscriptionZoneEnabled(zone.zoneId, next);
      toast.success(`Subscription ${next ? "ON" : "OFF"} for ${zone.name}`);
      await Promise.all([loadZones(), loadRestaurants()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update zone"));
    } finally {
      setZoneBusyId(null);
    }
  };

  // ---------- Packages ----------
  const openCreatePackage = () => {
    setPackageForm(EMPTY_PACKAGE_FORM);
    setPackageModal({ mode: "create" });
  };

  const openEditPackage = (pkg) => {
    setPackageForm({
      name: pkg.name || "",
      price: pkg.price ?? 0,
      durationDays: pkg.durationDays ?? 30,
      maxFoods: pkg.maxFoods ?? 0,
      maxOrders: pkg.maxOrders ?? 0,
      commissionRate: pkg.commissionRate ?? 0,
      featuresText: (pkg.features || []).join(", "),
      isActive: pkg.isActive !== false,
      zonePrices: Object.fromEntries((pkg.zonePrices || []).map((zp) => [zp.zoneId, String(zp.price)])),
    });
    setPackageModal({ mode: "edit", id: pkg._id });
  };

  const handleSavePackage = async (e) => {
    e.preventDefault();
    if (!packageForm.name.trim()) {
      toast.error("Please enter a package name");
      return;
    }
    const body = {
      name: packageForm.name.trim(),
      price: Number(packageForm.price),
      durationDays: Number(packageForm.durationDays),
      maxFoods: Number(packageForm.maxFoods || 0),
      maxOrders: Number(packageForm.maxOrders || 0),
      commissionRate: Number(packageForm.commissionRate || 0),
      features: packageForm.featuresText,
      isActive: packageForm.isActive,
      zonePrices: Object.entries(packageForm.zonePrices)
        .filter(([, price]) => String(price).trim() !== "")
        .map(([zoneId, price]) => ({ zoneId, price: Number(price) })),
    };
    try {
      setSaving(true);
      if (packageModal?.mode === "edit") {
        await adminAPI.updateSubscriptionPackage(packageModal.id, body);
        toast.success(`Package "${body.name}" updated`);
      } else {
        await adminAPI.createSubscriptionPackage(body);
        toast.success(`Package "${body.name}" created`);
      }
      setPackageModal(null);
      await loadPackages();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save package"));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePackage = async (pkg) => {
    try {
      await adminAPI.updateSubscriptionPackage(pkg._id, { isActive: !pkg.isActive });
      toast.success(`Package ${pkg.isActive ? "turned off" : "turned on"}`);
      await loadPackages();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update package"));
    }
  };

  const handleDeletePackage = async (pkg) => {
    if (!window.confirm(`Delete package "${pkg.name}"?`)) return;
    try {
      await adminAPI.deleteSubscriptionPackage(pkg._id);
      toast.success("Package deleted");
      await loadPackages();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete package"));
    }
  };

  // ---------- Assign / status ----------
  const activePackages = useMemo(() => packages.filter((p) => p.isActive !== false), [packages]);

  const selectPackageForAssign = (pkg, zoneId) => {
    setAssignForm((prev) => ({
      ...prev,
      packageId: pkg._id,
      durationDays: String(pkg.durationDays),
      price: String(getZonePrice(pkg, zoneId)),
    }));
  };

  const openAssign = (row) => {
    setAssignTarget(row);
    const current = activePackages.find((p) => p._id === row.subscription?.packageId) || activePackages[0];
    setAssignForm({ packageId: "", durationDays: "", price: "", notes: "" });
    if (current) selectPackageForAssign(current, row.zoneId);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignTarget || !assignForm.packageId) {
      toast.error("Please select a package");
      return;
    }
    try {
      setSaving(true);
      await adminAPI.assignRestaurantSubscription(assignTarget.restaurantId, {
        packageId: assignForm.packageId,
        durationDays: Number(assignForm.durationDays),
        price: Number(assignForm.price),
        notes: assignForm.notes,
      });
      toast.success(`Subscription assigned to ${assignTarget.restaurantName}`);
      setAssignTarget(null);
      await loadRestaurants();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to assign subscription"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row) => {
    const next = row.subscription?.status === "active" ? "inactive" : "active";
    try {
      setRowBusyId(row.restaurantId);
      await adminAPI.setRestaurantSubscriptionStatus(row.restaurantId, next);
      toast.success(`Subscription marked ${next.toUpperCase()}`);
      await loadRestaurants();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update status"));
    } finally {
      setRowBusyId(null);
    }
  };

  const statusTabs = [
    { id: "all", label: `All (${stats.total})`, className: "" },
    { id: "active", label: `Active (${stats.active})`, className: "text-emerald-600" },
    { id: "inactive", label: `Inactive (${stats.inactive})`, className: "text-rose-600" },
    { id: "expired", label: `Expired (${stats.expired})`, className: "text-amber-600" },
    { id: "none", label: `No Plan (${stats.none})`, className: "text-gray-600" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-[#FFFBEB] dark:bg-amber-950/40 text-[#D97706]">
              <Crown className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Restaurant Subscriptions</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Zone-wise plans and pricing, plan assignment, renewals and active/inactive status.
          </p>
        </div>
        <Button
          onClick={openCreatePackage}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Package
        </Button>
      </div>

      {/* Stats (for the selected zone) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Restaurants</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Plans</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
          <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Inactive / Expired</p>
          <p className="text-2xl font-black text-rose-500 mt-1">{stats.inactive + stats.expired}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Active Plans Value</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{formatINR(stats.activeValue)}</p>
        </div>
      </div>

      {/* Zone on/off */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs space-y-3">
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Zone-wise Subscription
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Kisi zone me subscription band karne par us zone ke restaurants ko plan assign nahi hoga aur unhe "My Subscription" menu nahi dikhega.
          </p>
        </div>
        {zones.length === 0 ? (
          <p className="text-sm text-gray-400">No zones found. Create zones first.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {zones.map((zone) => (
              <div
                key={zone.zoneId}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                  zone.subscriptionEnabled
                    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
                    : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{zone.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {zone.restaurantCount} restaurant{zone.restaurantCount === 1 ? "" : "s"}
                    {!zone.isZoneActive && " • zone inactive"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black ${zone.subscriptionEnabled ? "text-emerald-600" : "text-gray-500"}`}>
                    {zone.subscriptionEnabled ? "ON" : "OFF"}
                  </span>
                  <Toggle
                    checked={zone.subscriptionEnabled}
                    disabled={zoneBusyId === zone.zoneId}
                    onClick={() => handleToggleZone(zone)}
                    title={zone.subscriptionEnabled ? "Turn off subscription for this zone" : "Turn on subscription for this zone"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Packages */}
      <div className="space-y-3">
        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          Subscription Packages
        </h2>
        {packages.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-2">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No subscription packages created yet</p>
            <p className="text-xs text-gray-400">Click "+ Create New Package" above to define plans and zone-wise pricing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg._id}
                className={`bg-white dark:bg-gray-900 p-5 rounded-2xl border shadow-2xs flex flex-col justify-between gap-4 ${
                  pkg.isActive ? "border-gray-100 dark:border-gray-800" : "border-dashed border-gray-300 opacity-70"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-base truncate">{pkg.name}</h3>
                    <Badge className={pkg.isActive ? "bg-amber-100 text-amber-900" : "bg-gray-200 text-gray-600"}>
                      {pkg.isActive ? `${pkg.durationDays} Days` : "Off"}
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-gray-900 dark:text-white">{formatINR(pkg.price)}</span>
                    <span className="text-xs text-gray-500">default / {pkg.durationDays} days</span>
                  </div>
                  {pkg.zonePrices?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.zonePrices.map((zp) => (
                        <span
                          key={zp.zoneId}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          {zoneNameById[zp.zoneId] || "Zone"}: {formatINR(zp.price)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500">
                    Max foods {pkg.maxFoods || "-"} • Max orders {pkg.maxOrders || "-"} • Commission {pkg.commissionRate || 0}%
                  </p>
                  <ul className="space-y-1.5">
                    {(pkg.features || []).map((feat, idx) => (
                      <li key={idx} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => openEditPackage(pkg)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => handleTogglePackage(pkg)}>
                    <Power className="w-3.5 h-3.5 mr-1" /> {pkg.isActive ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs text-rose-600 ml-auto"
                    onClick={() => handleDeletePackage(pkg)}
                    title="Delete package"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restaurants table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search restaurant..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-gray-50 dark:bg-gray-800 border-none rounded-xl"
              />
            </div>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="h-10 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 text-sm text-gray-800 dark:text-gray-100 border-none"
            >
              <option value="all">All zones</option>
              {zones.map((z) => (
                <option key={z.zoneId} value={z.zoneId}>
                  {z.name}{z.subscriptionEnabled ? "" : " (OFF)"}
                </option>
              ))}
              <option value="none">No zone</option>
            </select>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {statusTabs.map((tab) => (
              <Button
                key={tab.id}
                variant={statusFilter === tab.id ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-xl text-xs whitespace-nowrap ${statusFilter === tab.id ? "" : tab.className}`}
              >
                {tab.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="rounded-xl" onClick={loadRestaurants} title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-[11px] font-black uppercase text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="p-4">Restaurant</th>
                <th className="p-4">Zone</th>
                <th className="p-4">Current Plan</th>
                <th className="p-4">Validity</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">Loading restaurant subscriptions...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">No restaurants found for this filter.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const sub = row.subscription;
                  const badge = sub ? STATUS_BADGE[sub.status] : null;
                  const zoneOff = !row.zoneSubscriptionEnabled;
                  return (
                    <tr key={row.restaurantId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 flex items-center justify-center font-black flex-shrink-0">
                            {(row.restaurantName || "R").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{row.restaurantName || "Unnamed Restaurant"}</p>
                            <p className="text-[11px] text-gray-400">{row.ownerName || row.ownerPhone || "Partner"}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-gray-700 dark:text-gray-200">{row.zoneName || "No zone"}</p>
                        {zoneOff && <Badge className="mt-1 bg-gray-200 text-gray-700">Subscription OFF</Badge>}
                      </td>

                      <td className="p-4">
                        {sub ? (
                          <div>
                            <span className="font-extrabold text-gray-800 dark:text-gray-200">{sub.packageName}</span>
                            <p className="text-[10px] text-gray-400">{formatINR(sub.price)} ({sub.durationDays} Days)</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No Subscription</span>
                        )}
                      </td>

                      <td className="p-4">
                        {sub?.endDate ? (
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                              Until {new Date(sub.endDate).toLocaleDateString("en-IN")}
                              {sub.status === "active" && <span className="text-emerald-600 font-bold"> • {sub.daysLeft}d left</span>}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="p-4">
                        {sub ? (
                          <div className="flex items-center gap-2">
                            {sub.status !== "expired" && (
                              <Toggle
                                checked={sub.status === "active"}
                                disabled={rowBusyId === row.restaurantId || (zoneOff && sub.status !== "active")}
                                onClick={() => handleToggleStatus(row)}
                                title={sub.status === "active" ? "Click to deactivate" : "Click to activate"}
                              />
                            )}
                            <Badge className={badge?.className}>{badge?.label}</Badge>
                          </div>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Unassigned</Badge>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => openAssign(row)}
                          disabled={zoneOff || activePackages.length === 0}
                          title={
                            zoneOff
                              ? "Subscription is OFF for this zone"
                              : activePackages.length === 0
                                ? "Create a package first"
                                : undefined
                          }
                          className="bg-[#1E1E1E] hover:bg-black text-white font-bold text-xs rounded-xl px-3"
                        >
                          {sub ? "Renew / Change" : "Assign Plan"}
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

      {/* Assign / renew modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  {assignTarget.subscription ? "Renew / Change Plan" : "Assign Subscription"}
                </h3>
                <p className="text-xs text-gray-500">
                  {assignTarget.restaurantName} • {assignTarget.zoneName || "No zone"}
                </p>
              </div>
              <button onClick={() => setAssignTarget(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full">✕</button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Select Plan (price for this zone)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activePackages.map((pkg) => (
                    <button
                      key={pkg._id}
                      type="button"
                      onClick={() => selectPackageForAssign(pkg, assignTarget.zoneId)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        assignForm.packageId === pkg._id
                          ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20"
                          : "border-gray-100 dark:border-gray-800 hover:border-gray-200"
                      }`}
                    >
                      <p className="font-extrabold text-xs text-gray-900 dark:text-white truncate">{pkg.name}</p>
                      <p className="text-sm font-black text-amber-600 mt-1">{formatINR(getZonePrice(pkg, assignTarget.zoneId))}</p>
                      <p className="text-[10px] text-gray-400">{pkg.durationDays} days</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Duration (Days)</label>
                  <Input
                    type="number"
                    min={1}
                    value={assignForm.durationDays}
                    onChange={(e) => setAssignForm((p) => ({ ...p, durationDays: e.target.value }))}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Subscription Fee (₹)</label>
                  <Input
                    type="number"
                    min={0}
                    value={assignForm.price}
                    onChange={(e) => setAssignForm((p) => ({ ...p, price: e.target.value }))}
                    className="rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Note (optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. Paid by UPI, ref #1234"
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm((p) => ({ ...p, notes: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              {assignTarget.subscription?.status === "active" &&
                assignTarget.subscription.packageId === assignForm.packageId && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                    Same active plan: the new days will be added to the current end date ({assignTarget.subscription.daysLeft} days left).
                  </p>
                )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAssignTarget(null)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#1E1E1E] hover:bg-black text-white font-extrabold text-xs rounded-xl px-5"
                >
                  {saving ? "Saving..." : "Confirm Subscription"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / edit package modal */}
      {packageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    {packageModal.mode === "edit" ? "Edit Package" : "Create New Package"}
                  </h3>
                  <p className="text-xs text-gray-500">Default price, limits and zone-wise prices</p>
                </div>
              </div>
              <button onClick={() => setPackageModal(null)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Package Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Gold Plan"
                  value={packageForm.name}
                  onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Default Price (₹)</label>
                  <Input
                    type="number"
                    min={0}
                    value={packageForm.price}
                    onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                    className="rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Validity (Days)</label>
                  <Input
                    type="number"
                    min={1}
                    value={packageForm.durationDays}
                    onChange={(e) => setPackageForm({ ...packageForm, durationDays: e.target.value })}
                    className="rounded-xl"
                    required
                  />
                </div>
              </div>

              {zones.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-gray-100 dark:border-gray-800 p-3">
                  <div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Zone-wise Price (₹)</p>
                    <p className="text-[11px] text-gray-400">Khali chhodne par us zone me default price lagega.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {zones.map((zone) => (
                      <div key={zone.zoneId} className="space-y-1">
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          {zone.name}
                          {!zone.subscriptionEnabled && <span className="text-[9px] text-gray-400">(OFF)</span>}
                        </label>
                        <Input
                          type="number"
                          min={0}
                          placeholder={`Default ₹${packageForm.price || 0}`}
                          value={packageForm.zonePrices[zone.zoneId] ?? ""}
                          onChange={(e) =>
                            setPackageForm({
                              ...packageForm,
                              zonePrices: { ...packageForm.zonePrices, [zone.zoneId]: e.target.value },
                            })
                          }
                          className="rounded-xl h-9"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Max Foods</label>
                  <Input
                    type="number"
                    min={0}
                    value={packageForm.maxFoods}
                    onChange={(e) => setPackageForm({ ...packageForm, maxFoods: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Max Orders</label>
                  <Input
                    type="number"
                    min={0}
                    value={packageForm.maxOrders}
                    onChange={(e) => setPackageForm({ ...packageForm, maxOrders: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Commission %</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={packageForm.commissionRate}
                    onChange={(e) => setPackageForm({ ...packageForm, commissionRate: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Key Features (Comma Separated)</label>
                <Input
                  type="text"
                  placeholder="Feature 1, Feature 2, Feature 3"
                  value={packageForm.featuresText}
                  onChange={(e) => setPackageForm({ ...packageForm, featuresText: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={packageForm.isActive}
                  onChange={(e) => setPackageForm({ ...packageForm, isActive: e.target.checked })}
                />
                Package is active (can be assigned)
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPackageModal(null)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl px-5"
                >
                  {saving ? "Saving..." : packageModal.mode === "edit" ? "Save Changes" : "Create Package"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
