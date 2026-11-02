/**
 * Turns a restaurant's full report into downloadable files.
 *
 * The report is several tables (profile, earnings, menu, items sold, orders) rather than one,
 * so every format keeps them as labelled sections instead of flattening them into a single
 * sheet where the columns would not line up.
 */

const INR = "₹"

const money = (value) =>
  `${INR}${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-"

const timestamp = () => new Date().toISOString().split("T")[0]

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Each section is { title, headers: [...], rows: [[...]] }. */
export function buildRestaurantFullReportSections(report) {
  const r = report?.restaurant || {}
  const e = report?.earnings || {}
  const o = report?.orders || {}
  const c = report?.commissionSetup || {}
  const w = report?.withdrawals || {}

  const sections = []

  sections.push({
    title: "Restaurant profile",
    headers: ["Field", "Value"],
    rows: [
      ["Restaurant name", r.name || "-"],
      ["Owner", r.ownerName || "-"],
      ["Phone", r.ownerPhone || "-"],
      ["Email", r.ownerEmail || "-"],
      ["Address", r.address || "-"],
      ["Zone", r.zone || "-"],
      ["Status", r.status || "-"],
      ["Accepting orders", r.isAcceptingOrders ? "Yes" : "No"],
      ["Cuisines", (r.cuisines || []).join(", ") || "-"],
      ["FSSAI number", r.fssaiNumber || "-"],
      ["GST number", r.gstNumber || "-"],
      ["Joined on", formatDate(r.joinedOn)],
      ["Rating", `${Number(r.rating || 0).toFixed(1)} (${r.totalRatings || 0} ratings)`],
      [
        "Commission",
        `${c.value || 0}${c.type === "percentage" ? "%" : ` ${INR}`} (${c.isCustom ? "custom" : "global"})`,
      ],
      ["Report period", report?.period?.label || "All Time"],
    ],
  })

  sections.push({
    title: "Order summary",
    headers: ["Metric", "Value"],
    rows: [
      ["Total orders", o.total ?? 0],
      ["Delivered", o.delivered ?? 0],
      ["Cancelled", o.cancelled ?? 0],
      ...Object.entries(o.byStatus || {}).map(([status, count]) => [`Status: ${status}`, count]),
    ],
  })

  sections.push({
    title: "Earnings (delivered orders)",
    headers: ["Line", "Amount"],
    rows: [
      ["Gross sales (customer paid)", money(e.grossSales)],
      ["Item subtotal (includes admin markup)", money(e.itemSubtotal)],
      ["Restaurant item value (payout base)", money(e.restaurantItemValue)],
      ["Admin food markup", money(e.adminMarkup)],
      ["Packaging fee", money(e.packagingFee)],
      ["Delivery fee", money(e.deliveryFee)],
      ["Platform fee", money(e.platformFee)],
      ["Tax collected", money(e.tax)],
      ["Discount given", money(e.discountGiven)],
      ["Admin commission", money(e.adminCommission)],
      ["GST on item", money(e.gstOnItem)],
      ["GST on commission", money(e.gstOnCommission)],
      ["Payment gateway fee", money(e.paymentGatewayFee)],
      ["TCS", money(e.tcs)],
      ["Rider payout", money(e.riderPayout)],
      ["Admin net profit", money(e.adminNetProfit)],
      ["Restaurant payout (earning)", money(e.restaurantPayout)],
      ["Settled payout", money(e.settledPayout)],
      ["Unsettled payout", money(e.unsettledPayout)],
      ["Average order value", money(e.averageOrderValue)],
    ],
  })

  sections.push({
    title: "Withdrawals",
    headers: ["Status", "Amount"],
    rows: [
      ["Pending", money(w.pending)],
      ["Approved", money(w.approved)],
      ["Processed", money(w.processed)],
      ["Rejected", money(w.rejected)],
      ["Total (excluding rejected)", money(w.total)],
    ],
  })

  sections.push({
    title: `Menu items added (${report?.menu?.total ?? 0})`,
    headers: [
      "#",
      "Item",
      "Category",
      "Type",
      "Price",
      "Variants",
      "Qty sold",
      "Revenue",
      "Approval",
      "Available",
      "Added on",
    ],
    rows: (report?.menu?.items || []).map((item) => [
      item.sl,
      item.name,
      item.category || "-",
      item.foodType || "-",
      money(item.price),
      (item.variants || []).map((v) => `${v.name}: ${money(v.price)}`).join(" | ") || "-",
      item.quantitySold,
      money(item.revenue),
      item.approvalStatus,
      item.isAvailable ? "Yes" : "No",
      formatDate(item.addedOn),
    ]),
  })

  sections.push({
    title: `Items ordered (${report?.orderedItems?.distinctItems ?? 0})`,
    headers: ["#", "Item", "Qty sold", "Orders", "Revenue", "Still on menu"],
    rows: (report?.orderedItems?.items || []).map((item) => [
      item.sl,
      item.name,
      item.quantitySold,
      item.orders,
      money(item.revenue),
      item.stillOnMenu ? "Yes" : "No",
    ]),
  })

  sections.push({
    title: `Orders (${report?.recentOrders?.length ?? 0})`,
    headers: [
      "Order ID",
      "Date",
      "Status",
      "Payment",
      "Items",
      "Subtotal",
      "Markup",
      "Commission",
      "Tax",
      "Discount",
      "Total",
    ],
    rows: (report?.recentOrders || []).map((o2) => [
      o2.orderId,
      formatDate(o2.createdAt),
      o2.status,
      o2.paymentMethod || "-",
      o2.items || "-",
      money(o2.subtotal),
      money(o2.markup),
      money(o2.adminCommission),
      money(o2.tax),
      money(o2.discount),
      money(o2.total),
    ]),
  })

  return sections
}

const csvCell = (value) => {
  // Currency symbols confuse spreadsheet number parsing, so they are stripped here.
  const text = String(value ?? "").replace(/[₹]/g, "").trim()
  return `"${text.replace(/"/g, '""')}"`
}

export function downloadRestaurantFullReportCSV(sections, filename, extension = "csv") {
  const lines = []
  sections.forEach((section, index) => {
    if (index > 0) lines.push("")
    lines.push(csvCell(section.title))
    lines.push(section.headers.map(csvCell).join(","))
    if (section.rows.length === 0) {
      lines.push(csvCell("No data"))
    } else {
      section.rows.forEach((row) => lines.push(row.map(csvCell).join(",")))
    }
  })

  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: extension === "xls" ? "application/vnd.ms-excel" : "text/csv;charset=utf-8;",
  })
  triggerDownload(blob, `${filename}_${timestamp()}.${extension}`)
}

export function downloadRestaurantFullReportJSON(report, filename) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json;charset=utf-8;",
  })
  triggerDownload(blob, `${filename}_${timestamp()}.json`)
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

export function printRestaurantFullReportPDF(sections, report) {
  const title = `${report?.restaurant?.name || "Restaurant"} - Full Report`
  const tables = sections
    .map((section) => {
      const body =
        section.rows.length === 0
          ? `<tr><td colspan="${section.headers.length}">No data</td></tr>`
          : section.rows
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
              )
              .join("")
      return `
        <h2>${escapeHtml(section.title)}</h2>
        <table>
          <thead><tr>${section.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      `
    })
    .join("")

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          h2 { font-size: 13px; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
          p.meta { color: #555; font-size: 11px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: left; font-size: 10px; }
          th { background: #f2f2f2; }
          tr:nth-child(even) td { background: #fafafa; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">Period: ${escapeHtml(report?.period?.label || "All Time")} &middot; Generated on ${escapeHtml(new Date().toLocaleString())}</p>
        ${tables}
      </body>
    </html>
  `

  const printWindow = window.open("", "_blank")
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 300)
}
