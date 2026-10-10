import { useEffect, useMemo, useState } from "react";
import { BellRing, Loader2, Search, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";

// Who receives the push. "CUSTOM" = specific people picked below.
const AUDIENCE_OPTIONS = [
  { value: "USER", label: "All Users" },
  { value: "RESTAURANT", label: "All Restaurants" },
  { value: "DELIVERY", label: "All Delivery Partners" },
  { value: "ALL", label: "Everyone" },
  { value: "CUSTOM", label: "Specific people" },
];

const RECIPIENT_TYPES = [
  { value: "USER", label: "Users" },
  { value: "RESTAURANT", label: "Restaurants" },
  { value: "DELIVERY_PARTNER", label: "Delivery" },
];

// Ready-made messages the admin can start from and edit.
const TEMPLATES = [
  {
    label: "Rain + chai",
    audience: "USER",
    title: "It's raining ☔",
    message: "Perfect weather for a hot cup of chai and healthy snacks. Order now on DietVala!",
    link: "/food/user",
  },
  {
    label: "Weekend offer",
    audience: "USER",
    title: "Weekend special 🎉",
    message: "Special offers on your favourite healthy meals today. Check them out!",
    link: "/food/user/offers",
  },
  {
    label: "Restaurant: busy hours",
    audience: "RESTAURANT",
    title: "Peak hours ahead 🍽️",
    message: "Expect more orders this evening. Keep your menu and stock updated and stay online.",
    link: "/food/restaurant",
  },
  {
    label: "Delivery: rain alert",
    audience: "DELIVERY",
    title: "Rain alert 🌧️",
    message: "It's raining. Ride carefully: safety first, delivery second.",
    link: "/food/delivery",
  },
];

const EMPTY_FORM = { title: "", message: "", targetType: "USER", image: "", link: "", voipToken: "" };

const toDateLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const recipientKey = (item) => `${item.ownerType}:${item.ownerId}`;

const typeLabel = (ownerType) =>
  ownerType === "DELIVERY_PARTNER" ? "Delivery" : ownerType === "RESTAURANT" ? "Restaurant" : "User";

export default function NotificationBroadcast() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Specific-people picker
  const [recipientType, setRecipientType] = useState("USER");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [selected, setSelected] = useState([]);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await adminAPI.getBroadcastNotifications({ page: 1, limit: 50 });
      setHistory(response?.data?.data?.items || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Search recipients on the server (debounced) when picking specific people.
  useEffect(() => {
    if (form.targetType !== "CUSTOM") return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setResultsLoading(true);
        const response = await adminAPI.searchBroadcastRecipients({
          ownerType: recipientType,
          q: search.trim(),
          limit: 30,
        });
        if (!cancelled) {
          setResults(response?.data?.data?.items || []);
          setResultsError("");
        }
      } catch (error) {
        if (!cancelled) {
          setResults([]);
          setResultsError(
            error?.response?.status === 404
              ? "Recipient search is not available on the server yet. Please deploy the latest backend and restart it."
              : error?.response?.data?.message || "Could not load recipients. Please try again."
          );
        }
      } finally {
        if (!cancelled) setResultsLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.targetType, recipientType, search]);

  const selectedKeys = useMemo(() => new Set(selected.map(recipientKey)), [selected]);

  const toggleRecipient = (recipient) => {
    const key = recipientKey(recipient);
    setSelected((prev) =>
      prev.some((item) => recipientKey(item) === key)
        ? prev.filter((item) => recipientKey(item) !== key)
        : [...prev, recipient]
    );
  };

  const applyTemplate = (template) => {
    setForm((prev) => ({
      ...prev,
      title: template.title,
      message: template.message,
      link: template.link,
      targetType: prev.targetType === "CUSTOM" ? "CUSTOM" : template.audience,
    }));
  };

  const audienceLabel = AUDIENCE_OPTIONS.find((o) => o.value === form.targetType)?.label || form.targetType;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const message = form.message.trim();
    const image = form.image.trim();
    const link = form.link.trim();

    if (!title || !message) {
      toast.error("Title and message are both required");
      return;
    }
    if (form.targetType === "CUSTOM" && selected.length === 0) {
      toast.error("Select at least one person");
      return;
    }
    if (image && !/^https:\/\//i.test(image)) {
      toast.error("Image URL must start with https://");
      return;
    }
    if (link && !link.startsWith("/")) {
      toast.error("Link must be an app page, like /food/user");
      return;
    }

    const audienceText =
      form.targetType === "CUSTOM" ? `${selected.length} selected people` : audienceLabel.toLowerCase();
    if (!window.confirm(`Send "${title}" to ${audienceText}?`)) return;

    try {
      setSubmitting(true);
      const response = await adminAPI.createBroadcastNotification({
        title,
        message,
        image,
        link,
        targetType: form.targetType,
        voipToken: form.voipToken.trim(),
        targets:
          form.targetType === "CUSTOM"
            ? selected.map((item) => ({
                ownerType: item.ownerType,
                ownerId: item.ownerId,
                label: item.label,
                subLabel: item.subLabel,
              }))
            : [],
      });
      const data = response?.data?.data || {};
      const total = data.recipientCount ?? data.targetPreview?.length ?? 0;
      const reach = data.pushReachable;
      toast.success(
        reach === null || reach === undefined
          ? `Notification sent to ${total} recipient(s)`
          : `Notification sent to ${total} recipient(s). ${reach} of them have push enabled; the rest will see it in their in-app notifications.`
      );
      setForm(EMPTY_FORM);
      setSelected([]);
      setSearch("");
      window.dispatchEvent(new Event("adminBroadcastUpdated"));
      await loadHistory();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Notification could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("Delete this notification from history and from everyone's in-app inbox?")) return;
    try {
      await adminAPI.deleteBroadcastNotification(id);
      window.dispatchEvent(new Event("adminBroadcastUpdated"));
      await loadHistory();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Delete failed");
    }
  };

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto space-y-3">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <BellRing className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Send Push Notification</h1>
              <p className="text-[11px] text-slate-500">
                Send phone notifications to users, restaurants or delivery partners: everyone, or specific people.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Form */}
          <div className="lg:col-span-5 bg-white rounded-lg shadow-sm border border-slate-200 p-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Templates */}
              <div>
                <span className="text-xs font-semibold text-slate-700">Quick templates</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience */}
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Send to</span>
                <select
                  value={form.targetType}
                  onChange={(event) => setForm((prev) => ({ ...prev, targetType: event.target.value }))}
                  className={inputClass}
                >
                  {AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.targetType === "CUSTOM" && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 space-y-2">
                  <div className="flex gap-1">
                    {RECIPIENT_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setRecipientType(type.value)}
                        className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
                          recipientType === type.value
                            ? "bg-blue-600 text-white"
                            : "bg-white text-slate-600 border border-slate-200"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, phone or email"
                      className="w-full text-xs bg-transparent outline-none flex-1"
                    />
                  </div>

                  {selected.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selected.map((item) => (
                        <span
                          key={recipientKey(item)}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                        >
                          {typeLabel(item.ownerType)}: {item.label}
                          <button type="button" onClick={() => toggleRecipient(item)} aria-label="Remove">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {resultsLoading ? (
                      <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Searching...
                      </div>
                    ) : resultsError ? (
                      <div className="p-3 text-xs text-red-600">{resultsError}</div>
                    ) : results.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500">No one found.</div>
                    ) : (
                      results.map((recipient) => (
                        <label
                          key={recipientKey(recipient)}
                          className="flex items-start gap-2 px-2 py-2 cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(recipientKey(recipient))}
                            onChange={() => toggleRecipient(recipient)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-slate-900 leading-tight">{recipient.label}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{recipient.subLabel || "-"}</div>
                          </div>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                              recipient.hasPush ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                            title={recipient.hasPush ? "Will get a push on their phone" : "No push token: will only see it in the in-app inbox"}
                          >
                            {recipient.hasPush ? "Push on" : "No push"}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Title</span>
                <input
                  value={form.title}
                  maxLength={65}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="e.g. It's raining ☔"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Message</span>
                <textarea
                  value={form.message}
                  maxLength={240}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  placeholder="e.g. Order a hot cup of chai, delivered home!"
                  rows={3}
                  className={`${inputClass} resize-y`}
                />
                <span className="text-[10px] text-slate-400">{form.message.length}/240</span>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Image URL (optional)</span>
                <input
                  value={form.image}
                  onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.value }))}
                  placeholder="https://.../banner.jpg"
                  className={inputClass}
                />
                <span className="text-[10px] text-slate-400">Shows a large picture in the notification (Android/Chrome).</span>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Open on tap (optional)</span>
                <input
                  value={form.link}
                  onChange={(event) => setForm((prev) => ({ ...prev, link: event.target.value }))}
                  placeholder="/food/user"
                  className={inputClass}
                />
                <span className="text-[10px] text-slate-400">Tapping the notification opens this page in the app.</span>
              </label>

              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-slate-600">Advanced</summary>
                <label className="block mt-2">
                  <span className="text-xs font-semibold text-slate-700">iOS VoIP Token</span>
                  <input
                    value={form.voipToken}
                    onChange={(event) => setForm((prev) => ({ ...prev, voipToken: event.target.value }))}
                    placeholder="Paste one or more VoIP tokens, comma separated"
                    className={inputClass}
                  />
                  <span className="text-[10px] text-slate-500">Optional. Rings a specific iPhone directly.</span>
                </label>
              </details>

              {/* Preview */}
              <div>
                <span className="text-xs font-semibold text-slate-700">Preview</span>
                <div className="mt-1 rounded-xl bg-slate-800 p-2">
                  <div className="rounded-lg bg-white p-2.5 shadow">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <img src="/logo.png" alt="" className="h-3.5 w-3.5 rounded" />
                      DietVala • now
                    </div>
                    <div className="mt-1 text-[12px] font-bold text-slate-900">{form.title || "Notification title"}</div>
                    <div className="text-[11px] text-slate-600 whitespace-pre-line">
                      {form.message || "Your notification message appears here"}
                    </div>
                    {/^https:\/\//i.test(form.image.trim()) && (
                      <img src={form.image.trim()} alt="" className="mt-2 max-h-32 w-full rounded object-cover" />
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-all w-full"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {form.targetType === "CUSTOM" ? `Send to ${selected.length} selected` : `Send to ${audienceLabel}`}
              </button>
            </form>
          </div>

          {/* History */}
          <div className="lg:col-span-7 bg-white rounded-lg shadow-sm border border-slate-200 p-3">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Sent notifications</h2>

            {historyLoading ? (
              <div className="py-10 text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <div className="py-10 text-xs text-slate-500 text-center">No notifications sent yet.</div>
            ) : (
              <div className="overflow-x-auto scrollbar-hide border border-slate-200 rounded-lg">
                <table className="w-full text-left" style={{ tableLayout: "auto" }}>
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Title</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Message</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Sent to</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Recipients</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {history.map((item) => (
                      <tr key={item?._id} className="hover:bg-slate-50 transition-colors align-top">
                        <td className="px-3 py-2">
                          <span className="text-[11px] font-semibold text-slate-900">{item?.title || "Notification"}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[11px] text-slate-600 line-clamp-2 max-w-[220px]">{item?.message || "-"}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[11px] text-slate-700 whitespace-nowrap">
                            {item?.targetType === "ALL" ? "Everyone" : item?.targetLabel || item?.targetType}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[11px] font-medium text-slate-700">
                            {item?.targetCount || item?.targets?.length || 0}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[11px] text-slate-500">{toDateLabel(item?.createdAt)}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(item?._id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
