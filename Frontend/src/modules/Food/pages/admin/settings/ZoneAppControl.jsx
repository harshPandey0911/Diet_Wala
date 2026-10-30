import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, MapPin, PauseCircle, Power } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";

const Switch = ({ checked, onClick, disabled, tone = "bg-blue-600", label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
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

const StatusPill = ({ tone, children }) => {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "green" ? "bg-emerald-500" : tone === "red" ? "bg-red-500" : "bg-amber-500"}`} />
      {children}
    </span>
  );
};

const ControlRow = ({ icon: Icon, iconTone, title, description, children, control }) => (
  <div className="py-4 first:pt-0 last:pb-0">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex-shrink-0 pt-0.5">{control}</div>
    </div>
    {children && <div className="mt-3 pl-11">{children}</div>}
  </div>
);

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

const pickEditable = (zone) => ({
  appManualOff: zone.appManualOff === true,
  appTimingEnabled: zone.appTimingEnabled === true,
  appOpeningTime: zone.appOpeningTime || "08:00",
  appClosingTime: zone.appClosingTime || "23:00",
  appClosedMessage: zone.appClosedMessage || "",
  orderingPaused: zone.orderingPaused === true,
  orderingPausedMessage: zone.orderingPausedMessage || "",
});

// One card per zone with three independent controls:
//  - Pause ordering: customers still see everything but cannot place orders.
//  - Close app: customers see an "app is closed" screen.
//  - Daily timings: the app closes/opens automatically (IST).
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

  const save = async (zone, patch, successMessage) => {
    setSavingId(zone._id);
    try {
      const response = await adminAPI.updateZoneAppStatus(zone._id, patch);
      const updated = response?.data?.data;
      if (updated) {
        setZones((prev) => prev.map((z) => (z._id === zone._id ? { ...z, ...updated } : z)));
        setDrafts((prev) => ({ ...prev, [zone._id]: pickEditable(updated) }));
      }
      toast.success(successMessage || `${zone.name}: saved`);
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
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 md:col-span-2 lg:p-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">Zone-wise App Control</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Control each zone separately. Changes apply to customers in that zone within about 30 seconds; other zones are
          not affected. The platform-wide switch below overrides every zone.
        </p>
      </div>

      {zones.length === 0 && <p className="text-xs text-slate-500">No active zones found.</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {zones.map((zone) => {
          const draft = drafts[zone._id] || pickEditable(zone);
          const busy = savingId === zone._id;
          const appClosed = zone.appStatus?.isOpen === false;
          const paused = zone.orderingPaused === true;

          return (
            <div key={zone._id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-900">{zone.name}</p>
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={appClosed ? "red" : "green"}>{appClosed ? "App closed" : "App open"}</StatusPill>
                  <StatusPill tone={paused ? "amber" : "green"}>{paused ? "Ordering paused" : "Ordering on"}</StatusPill>
                </div>
              </div>

              <div className="divide-y divide-slate-200 px-4 py-4">
                <ControlRow
                  icon={PauseCircle}
                  iconTone="bg-amber-100 text-amber-700"
                  title="Pause ordering"
                  description="Customers can still see restaurants, menus and their cart. They just cannot place orders."
                  control={
                    <Switch
                      label={`Pause ordering in ${zone.name}`}
                      checked={draft.orderingPaused}
                      tone="bg-amber-500"
                      disabled={busy}
                      onClick={() => {
                        const next = !draft.orderingPaused;
                        setDraft(zone._id, { orderingPaused: next });
                        save(zone, { orderingPaused: next }, `${zone.name}: ordering ${next ? "paused" : "resumed"}`);
                      }}
                    />
                  }
                >
                  {draft.orderingPaused && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Message shown to customers (optional)
                        <input
                          type="text"
                          maxLength={200}
                          placeholder="Ordering is temporarily paused in your area."
                          value={draft.orderingPausedMessage}
                          onChange={(e) => setDraft(zone._id, { orderingPausedMessage: e.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          save(zone, { orderingPausedMessage: draft.orderingPausedMessage }, `${zone.name}: message saved`)
                        }
                        className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Save message
                      </button>
                    </div>
                  )}
                </ControlRow>

                <ControlRow
                  icon={Power}
                  iconTone="bg-red-100 text-red-700"
                  title="Close app"
                  description="Hides the whole app for this zone behind an “App is closed” screen. Ignores daily timings until switched off."
                  control={
                    <Switch
                      label={`Close app in ${zone.name}`}
                      checked={draft.appManualOff}
                      tone="bg-red-500"
                      disabled={busy}
                      onClick={() => {
                        const next = !draft.appManualOff;
                        setDraft(zone._id, { appManualOff: next });
                        save(zone, { appManualOff: next }, `${zone.name}: app ${next ? "closed" : "reopened"}`);
                      }}
                    />
                  }
                />

                <ControlRow
                  icon={Clock}
                  iconTone="bg-blue-100 text-blue-700"
                  title="Daily timings"
                  description="Opens and closes the app automatically every day (IST). Outside these hours customers see when it opens next."
                  control={
                    <Switch
                      label={`Daily timings in ${zone.name}`}
                      checked={draft.appTimingEnabled}
                      disabled={busy}
                      onClick={() => {
                        const next = !draft.appTimingEnabled;
                        setDraft(zone._id, { appTimingEnabled: next });
                        save(zone, { appTimingEnabled: next }, `${zone.name}: timings ${next ? "enabled" : "disabled"}`);
                      }}
                    />
                  }
                >
                  {draft.appTimingEnabled && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        App opens at
                        <input
                          type="time"
                          value={draft.appOpeningTime}
                          onChange={(e) => setDraft(zone._id, { appOpeningTime: e.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        App closes at
                        <input
                          type="time"
                          value={draft.appClosingTime}
                          onChange={(e) => setDraft(zone._id, { appClosingTime: e.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                        Closed-screen message (optional)
                        <input
                          type="text"
                          maxLength={200}
                          placeholder="e.g. We are closed for the night. See you in the morning!"
                          value={draft.appClosedMessage}
                          onChange={(e) => setDraft(zone._id, { appClosedMessage: e.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            save(
                              zone,
                              {
                                appTimingEnabled: true,
                                appOpeningTime: draft.appOpeningTime,
                                appClosingTime: draft.appClosingTime,
                                appClosedMessage: draft.appClosedMessage,
                              },
                              `${zone.name}: timings saved`,
                            )
                          }
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {busy ? "Saving..." : "Save timings"}
                        </button>
                      </div>
                    </div>
                  )}
                </ControlRow>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
