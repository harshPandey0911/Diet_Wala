import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"
import {
  Download,
  ChevronDown,
  Loader2,
  FileText,
  FileSpreadsheet,
  Code,
} from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import {
  buildRestaurantFullReportSections,
  downloadRestaurantFullReportCSV,
  downloadRestaurantFullReportJSON,
  printRestaurantFullReportPDF,
} from "./restaurantFullReportExport"

const INR = "₹"
const money = (value) => `${INR}${Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"

function Stat({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-50 border-emerald-200"
      : tone === "warn"
        ? "bg-rose-50 border-rose-200"
        : "bg-white border-slate-200"
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  )
}

function SectionTitle({ children, count }) {
  return (
    <div className="mt-6 mb-2 flex items-baseline gap-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{children}</h3>
      {count != null ? <span className="text-xs text-slate-500">({count})</span> : null}
    </div>
  )
}

/**
 * Everything about one restaurant in one place, with a download of the whole thing.
 * `time` mirrors the filter chosen on the Restaurant Report page so both agree.
 */
export default function RestaurantFullReportDialog({ restaurantId, time, open, onOpenChange }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState("overview")

  useEffect(() => {
    if (!open || !restaurantId) return undefined

    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const params = {}
        if (time && time !== "All Time") params.time = time
        const response = await adminAPI.getRestaurantFullReport(restaurantId, params)
        if (cancelled) return
        if (response?.data?.success && response.data.data) {
          setReport(response.data.data)
        } else {
          setReport(null)
          toast.error(response?.data?.message || "Could not load the restaurant report")
        }
      } catch (error) {
        if (cancelled) return
        setReport(null)
        toast.error(
          error?.response?.data?.message || "Could not load the restaurant report",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [open, restaurantId, time])

  useEffect(() => {
    if (!open) {
      setReport(null)
      setTab("overview")
    }
  }, [open])

  const handleDownload = (format) => {
    if (!report) {
      toast.error("Nothing to download yet")
      return
    }
    const sections = buildRestaurantFullReportSections(report)
    const base = `${(report.restaurant?.name || "restaurant").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_full_report`
    switch (format) {
      case "csv":
        downloadRestaurantFullReportCSV(sections, base)
        break
      case "excel":
        downloadRestaurantFullReportCSV(sections, base, "xls")
        break
      case "pdf":
        printRestaurantFullReportPDF(sections, report)
        break
      case "json":
        downloadRestaurantFullReportJSON(report, base)
        break
      default:
        break
    }
  }

  const r = report?.restaurant
  const e = report?.earnings
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "menu", label: `Menu (${report?.menu?.total ?? 0})` },
    { id: "sold", label: `Items sold (${report?.orderedItems?.distinctItems ?? 0})` },
    { id: "orders", label: `Orders (${report?.recentOrders?.length ?? 0})` },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto bg-white p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-lg">
                {r?.name || "Restaurant report"}
              </DialogTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Full report {report?.period?.label ? `- ${report.period.label}` : ""}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={!report}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Download
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50 w-56 rounded-lg border border-slate-200 bg-white shadow-lg">
                <DropdownMenuLabel>Download full report</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDownload("csv")} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("excel")} className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("pdf")} className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("json")} className="cursor-pointer">
                  <Code className="mr-2 h-4 w-4" />
                  JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Loading full report...
          </div>
        ) : !report ? (
          <div className="py-20 text-center text-slate-500">No report data available.</div>
        ) : (
          <div className="px-6 pb-8">
            <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    tab === t.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <>
                <SectionTitle>Profile</SectionTitle>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p><span className="text-slate-500">Owner:</span> {r?.ownerName || "-"}</p>
                  <p><span className="text-slate-500">Phone:</span> {r?.ownerPhone || "-"}</p>
                  <p><span className="text-slate-500">Email:</span> {r?.ownerEmail || "-"}</p>
                  <p><span className="text-slate-500">Zone:</span> {r?.zone || "-"}</p>
                  <p className="sm:col-span-2"><span className="text-slate-500">Address:</span> {r?.address || "-"}</p>
                  <p><span className="text-slate-500">Status:</span> {r?.status || "-"}</p>
                  <p><span className="text-slate-500">Joined:</span> {formatDate(r?.joinedOn)}</p>
                  <p><span className="text-slate-500">FSSAI:</span> {r?.fssaiNumber || "-"}</p>
                  <p><span className="text-slate-500">GST:</span> {r?.gstNumber || "-"}</p>
                  <p>
                    <span className="text-slate-500">Rating:</span>{" "}
                    {Number(r?.rating || 0).toFixed(1)} ({r?.totalRatings || 0})
                  </p>
                  <p>
                    <span className="text-slate-500">Commission:</span>{" "}
                    {report?.commissionSetup?.value || 0}
                    {report?.commissionSetup?.type === "percentage" ? "%" : ` ${INR}`}
                    {report?.commissionSetup?.isCustom ? " (custom)" : " (global)"}
                  </p>
                </div>

                <SectionTitle>Orders</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Total orders" value={report?.orders?.total ?? 0} />
                  <Stat label="Delivered" value={report?.orders?.delivered ?? 0} tone="positive" />
                  <Stat label="Cancelled" value={report?.orders?.cancelled ?? 0} tone="warn" />
                </div>

                <SectionTitle>Earnings (delivered orders)</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Gross sales" value={money(e?.grossSales)} hint="What customers paid" />
                  <Stat
                    label="Item subtotal"
                    value={money(e?.itemSubtotal)}
                    hint="Includes admin markup"
                  />
                  <Stat
                    label="Restaurant item value"
                    value={money(e?.restaurantItemValue)}
                    hint="Base the restaurant is paid on"
                  />
                  <Stat label="Admin markup" value={money(e?.adminMarkup)} hint="Platform margin" tone="warn" />
                  <Stat label="Admin commission" value={money(e?.adminCommission)} />
                  <Stat label="GST on item" value={money(e?.gstOnItem)} />
                  <Stat label="GST on commission" value={money(e?.gstOnCommission)} />
                  <Stat label="Payment gateway fee" value={money(e?.paymentGatewayFee)} />
                  <Stat label="TCS" value={money(e?.tcs)} />
                  <Stat label="Packaging fee" value={money(e?.packagingFee)} />
                  <Stat label="Delivery fee" value={money(e?.deliveryFee)} />
                  <Stat label="Platform fee" value={money(e?.platformFee)} />
                  <Stat label="Tax collected" value={money(e?.tax)} />
                  <Stat label="Discount given" value={money(e?.discountGiven)} />
                  <Stat label="Rider payout" value={money(e?.riderPayout)} />
                  <Stat label="Avg order value" value={money(e?.averageOrderValue)} />
                  <Stat
                    label="Restaurant payout"
                    value={money(e?.restaurantPayout)}
                    hint="Total earned by the restaurant"
                    tone="positive"
                  />
                  <Stat label="Settled" value={money(e?.settledPayout)} />
                  <Stat label="Unsettled" value={money(e?.unsettledPayout)} />
                  <Stat label="Admin net profit" value={money(e?.adminNetProfit)} tone="positive" />
                </div>

                <SectionTitle>Withdrawals</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Stat label="Pending" value={money(report?.withdrawals?.pending)} />
                  <Stat label="Approved" value={money(report?.withdrawals?.approved)} />
                  <Stat label="Processed" value={money(report?.withdrawals?.processed)} />
                  <Stat label="Rejected" value={money(report?.withdrawals?.rejected)} />
                </div>
              </>
            )}

            {tab === "menu" && (
              <>
                <SectionTitle count={report?.menu?.total}>Items added by this restaurant</SectionTitle>
                <p className="mb-3 text-xs text-slate-500">
                  {report?.menu?.available ?? 0} available, {report?.menu?.pendingApproval ?? 0} awaiting approval.
                  Prices shown are the restaurant&apos;s own prices (before the admin markup).
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Price</th>
                        <th className="px-3 py-2">Sold</th>
                        <th className="px-3 py-2">Revenue</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(report?.menu?.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                            This restaurant has not added any items yet.
                          </td>
                        </tr>
                      ) : (
                        report.menu.items.map((item) => (
                          <tr key={String(item.itemId)} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-500">{item.sl}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                            <td className="px-3 py-2 text-slate-600">{item.category || "-"}</td>
                            <td className="px-3 py-2 text-slate-600">{item.foodType || "-"}</td>
                            <td className="px-3 py-2">{money(item.price)}</td>
                            <td className="px-3 py-2">{item.quantitySold}</td>
                            <td className="px-3 py-2">{money(item.revenue)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  item.approvalStatus === "approved"
                                    ? item.isAvailable
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {item.approvalStatus !== "approved"
                                  ? item.approvalStatus
                                  : item.isAvailable
                                    ? "available"
                                    : "unavailable"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(item.addedOn)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "sold" && (
              <>
                <SectionTitle count={report?.orderedItems?.distinctItems}>
                  Items actually ordered from this restaurant
                </SectionTitle>
                <p className="mb-3 text-xs text-slate-500">
                  {report?.orderedItems?.totalQuantity ?? 0} units sold across delivered orders.
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Qty sold</th>
                        <th className="px-3 py-2">Orders</th>
                        <th className="px-3 py-2">Revenue</th>
                        <th className="px-3 py-2">On menu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(report?.orderedItems?.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                            No items have been ordered in this period.
                          </td>
                        </tr>
                      ) : (
                        report.orderedItems.items.map((item) => (
                          <tr key={`${item.sl}-${item.name}`} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-500">{item.sl}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                            <td className="px-3 py-2">{item.quantitySold}</td>
                            <td className="px-3 py-2">{item.orders}</td>
                            <td className="px-3 py-2">{money(item.revenue)}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {item.stillOnMenu ? "Yes" : "Removed"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "orders" && (
              <>
                <SectionTitle count={report?.recentOrders?.length}>Recent orders</SectionTitle>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Order</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Payment</th>
                        <th className="px-3 py-2">Items</th>
                        <th className="px-3 py-2">Subtotal</th>
                        <th className="px-3 py-2">Markup</th>
                        <th className="px-3 py-2">Commission</th>
                        <th className="px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(report?.recentOrders || []).length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                            No orders in this period.
                          </td>
                        </tr>
                      ) : (
                        report.recentOrders.map((o) => (
                          <tr key={o.orderId} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-900">{o.orderId}</td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(o.createdAt)}</td>
                            <td className="px-3 py-2 text-slate-600">{o.status}</td>
                            <td className="px-3 py-2 text-slate-600">{o.paymentMethod || "-"}</td>
                            <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={o.items}>
                              {o.items || "-"}
                            </td>
                            <td className="px-3 py-2">{money(o.subtotal)}</td>
                            <td className="px-3 py-2">{money(o.markup)}</td>
                            <td className="px-3 py-2">{money(o.adminCommission)}</td>
                            <td className="px-3 py-2 font-medium">{money(o.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
