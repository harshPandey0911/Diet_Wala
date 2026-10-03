import { useState, useEffect, useCallback } from "react"
import { Search, PiggyBank, Loader2, Package, RefreshCw, Wallet } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import WalletAdjustModal from "@food/components/admin/wallet/WalletAdjustModal"

const debugError = (...args) => {}

const formatCurrency = (amount) => {
  if (amount == null) return "₹0.00"
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function RestaurantWallet() {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [walletModalTarget, setWalletModalTarget] = useState(null)
  const limit = 20

  const fetchWallets = useCallback(async (overrides = {}) => {
    const p = overrides.page ?? page
    const q = overrides.search !== undefined ? overrides.search : searchQuery
    const silent = overrides.silent ?? false

    try {
      if (!silent) setLoading(true)
      const res = await adminAPI.getRestaurantWallets({
        search: q.trim() || undefined,
        page: p,
        limit,
      })
      if (res?.data?.success) {
        const data = res.data.data
        setWallets(data?.items || [])
        setTotal(data?.total || 0)
        setPages(data?.totalPages || 1)
      } else {
        if (!silent) toast.error(res?.data?.message || "Failed to fetch restaurant wallets")
        setWallets([])
      }
    } catch (err) {
      debugError("Error fetching restaurant wallets:", err)
      if (!silent) toast.error(err?.response?.data?.message || "Failed to fetch restaurant wallets")
      setWallets([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchWallets({ page: 1, search: searchQuery })
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PiggyBank className="w-5 h-5 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-900">Restaurant Wallet</h1>
            </div>
            <button
              onClick={() => fetchWallets()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            View each restaurant's wallet balance and manually credit/debit funds when needed.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Wallets</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {total}
              </span>
            </div>
            <div className="relative flex-1 w-full sm:w-[280px] lg:w-[350px]">
              <input
                type="text"
                placeholder="Search by restaurant name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-slate-600">Loading wallets…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Restaurant</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Phone</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Balance</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Locked</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Earnings</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Settled</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {wallets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="w-16 h-16 text-slate-400 mb-4" />
                          <p className="text-lg font-semibold text-slate-700">No wallets found</p>
                          <p className="text-sm text-slate-500 mt-1">
                            {searchQuery ? `No results for "${searchQuery}"` : "No restaurant wallets yet."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    wallets.map((w, i) => (
                      <tr key={w.restaurantId || i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">{(page - 1) * limit + i + 1}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-slate-800">{w.restaurantName || "—"}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{w.phone || "—"}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{formatCurrency(w.balance)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(w.lockedAmount)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(w.totalEarnings)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(w.totalSettled)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setWalletModalTarget({ entityId: w.restaurantId, entityLabel: w.restaurantName || "Restaurant" })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Page {page} of {pages} · {total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <WalletAdjustModal
        open={Boolean(walletModalTarget)}
        onClose={() => setWalletModalTarget(null)}
        entityType="restaurant"
        entityId={walletModalTarget?.entityId}
        entityLabel={walletModalTarget?.entityLabel}
        onSuccess={() => fetchWallets({ silent: true })}
      />
    </div>
  )
}
