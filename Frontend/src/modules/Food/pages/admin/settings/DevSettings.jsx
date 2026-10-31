import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";

const GROUPS = [
  { title: "Orders", keys: ["orders"] },
  { title: "Accounts", keys: ["customers", "restaurants", "deliveryPartners", "foods"] },
  { title: "Wallets", keys: ["userWallets", "deliveryWallets", "restaurantWallets"] },
  { title: "Other data", keys: ["supportTickets", "notifications", "offers", "categories", "banners"] },
];

const modelLabel = (name) => name.replace(/^Food/, "").replace(/([a-z])([A-Z])/g, "$1 $2");

function ConfirmModal({ section, busy, onCancel, onConfirm }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === section.confirmText;
  const affected = section.collections.filter((c) => c.count > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p className="text-base font-semibold text-slate-900">Clear {section.label}?</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-slate-600">{section.description}</p>
          {section.warning && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{section.warning}</p>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Only this will be affected
            </p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
              {section.collections.map((c) => (
                <li key={c.model} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-slate-700">
                    {modelLabel(c.model)}
                    <span className="ml-1.5 text-xs text-slate-400">{c.reset ? "(reset to 0)" : "(deleted)"}</span>
                  </span>
                  <span className="font-semibold text-slate-900">{c.count}</span>
                </li>
              ))}
            </ul>
            {affected.length === 0 && <p className="mt-2 text-xs text-slate-500">There is nothing to clear right now.</p>}
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Type <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-red-600">{section.confirmText}</span> to
            confirm
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(typed.trim())}
            disabled={!matches || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Clearing..." : "Clear data"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Dev Settings: super admin can wipe one data section at a time. Every section lists exactly which
// collections it touches, and needs a typed confirmation. Settings, zones and admin accounts are never touched.
export default function DevSettings() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getDevDataSections();
      setSections(response?.data?.data?.sections || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load data sections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearSection = async (confirmText) => {
    if (!target) return;
    setBusy(true);
    try {
      const response = await adminAPI.deleteDevData(target.key, confirmText);
      toast.success(response?.data?.message || `${target.label} cleared`);
      setTarget(null);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to clear data");
    } finally {
      setBusy(false);
    }
  };

  const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dev Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Clear test data one section at a time. Only the section you pick is affected; admin accounts, zones,
            settings and every other section stay as they are. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh counts
        </button>
      </div>

      {loading && sections.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        GROUPS.map((group) => {
          const items = group.keys.map((key) => byKey[key]).filter(Boolean);
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {items.map((section) => (
                  <div key={section.key} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          {section.total} record{section.total === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{section.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTarget(section)}
                      className="mt-3 inline-flex w-fit items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear {section.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {target && (
        <ConfirmModal section={target} busy={busy} onCancel={() => !busy && setTarget(null)} onConfirm={clearSection} />
      )}
    </div>
  );
}
