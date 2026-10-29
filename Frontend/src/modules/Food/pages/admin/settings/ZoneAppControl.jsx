import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";

const Switch = ({ checked, onClick, disabled, tone = "bg-blue-600", label }) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${
      checked ? tone : "bg-slate-200"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const pickEditable = (zone) => ({
  appManualOff: zone.appManualOff === true,
  appTimingEnabled: zone.appTimingEnabled === true,
  appOpeningTime: zone.appOpeningTime || "08:00",
  appClosingTime: zone.appClosingTime || "23:00",
  appClosedMessage: zone.appClosedMessage || "",
});

// One card per zone: manual OFF switch plus daily open/close hours (IST) for that zone only.
export default function ZoneAppControl() {
  const [zones, setZones] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await adminAPI.getZoneAppStatus();
      const list = response?.data?.data?.zones || [];
      setZones(list);
      setDrafts(Object.fromEntries(list.map((z) => [z._id, pickEditable(z)])));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load zones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setDraft = (id, patch) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const save = async (zone, patch) => {
    setSavingId(zone._id);
    try {
      const response = await adminAPI.updateZoneAppStatus(zone._id, patch);
      const updated = response?.data?.data;
      if (updated) {
        setZones((prev) => prev.map((z) => (z._id === zone._id ? { ...z, ...updated } : z)));
        setDrafts((prev) => ({ ...prev, [zone._id]: pickEditable(updated) }));
      }
      toast.success(`${zone.name}: saved`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save");
      await load();
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="md:col-span-2 flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="md:col-span-2 border border-slate-100 p-4 rounded-xl bg-slate-50/50 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">Zone-wise App Control</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Switch the app off, or set daily open/close hours (IST), for one zone at a time. Customers in that zone see
          "App is closed, opens at ..." and cannot order, even if a restaurant is online. Other zones are not affected.
          The platform-wide switch above overrides every zone.
        </p>
      </div>

      {zones.length === 0 && <p className="text-xs text-slate-500">No active zones found.</p>}

      {zones.map((zone) => {
        const draft = drafts[zone._id] || pickEditable(zone);
        const busy = savingId === zone._id;
        const closed = zone.appStatus?.isOpen === false;
        return (
          <div key={zone._id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{zone.name}</p>
                <span
                  className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    closed ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {closed ? "Closed now" : "Open now"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">App OFF</span>
                <Switch
                  label={`Turn app off in ${zone.name}`}
                  checked={draft.appManualOff}
                  tone="bg-red-500"
                  disabled={busy}
                  onClick={() => {
                    const next = !draft.appManualOff;
                    setDraft(zone._id, { appManualOff: next });
                    save(zone, { appManualOff: next });
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-700">Daily timings</p>
              <Switch
                label={`Toggle daily timings in ${zone.name}`}
                checked={draft.appTimingEnabled}
                disabled={busy}
                onClick={() => {
                  const next = !draft.appTimingEnabled;
                  setDraft(zone._id, { appTimingEnabled: next });
                  save(zone, { appTimingEnabled: next });
                }}
              />
            </div>

            {draft.appTimingEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600">
                  Opening time
                  <input
                    type="time"
                    value={draft.appOpeningTime}
                    onChange={(e) => setDraft(zone._id, { appOpeningTime: e.target.value })}
                    className="mt-1 block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Closing time
                  <input
                    type="time"
                    value={draft.appClosingTime}
                    onChange={(e) => setDraft(zone._id, { appClosingTime: e.target.value })}
                    className="mt-1 block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                  Custom message (optional)
                  <input
                    type="text"
                    maxLength={200}
                    placeholder="e.g. We are closed for the night. See you in the morning!"
                    value={draft.appClosedMessage}
                    onChange={(e) => setDraft(zone._id, { appClosedMessage: e.target.value })}
                    className="mt-1 block w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      save(zone, {
                        appTimingEnabled: true,
                        appOpeningTime: draft.appOpeningTime,
                        appClosingTime: draft.appClosingTime,
                        appClosedMessage: draft.appClosedMessage,
                      })
                    }
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busy ? "Saving..." : "Save timings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
