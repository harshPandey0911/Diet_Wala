import { useState, useMemo, useEffect } from "react"
import { ArrowLeft, Award, ArrowDownCircle, ArrowUpCircle, RefreshCw, Settings2, Loader2 } from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { userAPI } from "@food/api"
import { toast } from "sonner"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"

const debugError = (...args) => {}

const FILTERS = { ALL: "all", EARN: "earn", REDEEM: "redeem", REFUND: "refund", ADMIN_ADJUST: "admin_adjust" }

export default function LoyaltyPoints() {
  const goBack = useAppBackNavigation()
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState(FILTERS.ALL)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [summaryRes, historyRes] = await Promise.all([
        userAPI.getLoyaltyPoints(),
        userAPI.getLoyaltyHistory({ limit: 50 }),
      ])
      if (summaryRes?.data?.success) setSummary(summaryRes.data.data)
      if (historyRes?.data?.success) setTransactions(historyRes.data.data?.data || [])
    } catch (err) {
      debugError("Error fetching loyalty points:", err)
      setError(err?.response?.data?.message || "Failed to load loyalty points")
      toast.error("Failed to load loyalty points")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredTransactions = useMemo(() => {
    if (selectedFilter === FILTERS.ALL) return transactions
    return transactions.filter((t) => t.type === selectedFilter)
  }, [selectedFilter, transactions])

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return `${date.toLocaleDateString("en-IN", { year: "numeric", month: "2-digit", day: "2-digit" })} | ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`
  }

  const getTransactionIcon = (type) => {
    switch (type) {
      case "earn":
        return <ArrowDownCircle className="h-6 w-6 md:h-7 md:w-7 text-green-600 dark:text-green-400" />
      case "redeem":
        return <ArrowUpCircle className="h-6 w-6 md:h-7 md:w-7 text-red-600 dark:text-red-400" />
      case "refund":
        return <RefreshCw className="h-6 w-6 md:h-7 md:w-7 text-blue-600 dark:text-blue-400" />
      default:
        return <Settings2 className="h-6 w-6 md:h-7 md:w-7 text-gray-500" />
    }
  }

  const getTransactionColor = (type) =>
    type === "redeem" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="bg-white dark:bg-[#1a1a1a] sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 px-4 sm:px-6 md:px-8 lg:px-10 py-4 md:py-5">
            <button
              onClick={goBack}
              className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-gray-700 dark:text-white" />
            </button>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Loyalty Points</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8">
        {loading && (
          <div className="flex items-center justify-center py-12 md:py-16 lg:py-20">
            <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin text-gray-600 dark:text-gray-400" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 md:p-6">
            <p className="text-red-600 dark:text-red-400 text-sm md:text-base">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 lg:gap-8">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg transform rotate-[-5deg]">
                  <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-white/10 rounded-lg md:rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                    <Award className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <div className="absolute inset-0 bg-orange-800 rounded-xl md:rounded-2xl transform rotate-[-5deg] translate-y-1 -z-10 opacity-25" />
              </div>

              <div className="flex flex-col md:items-start items-center text-center md:text-left">
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mb-1">Your Points Balance</p>
                <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white">
                  {(summary?.balance ?? 0).toLocaleString("en-IN")}
                </p>
                <p className="text-sm md:text-base text-orange-600 dark:text-orange-400 font-semibold mt-1">
                  Worth {"₹"}{(summary?.redemptionValue ?? 0).toLocaleString("en-IN")} in free food
                </p>
                {summary?.settings?.minPointsToRedeem > 0 && (summary?.balance ?? 0) < summary.settings.minPointsToRedeem && (
                  <p className="text-xs text-gray-400 mt-2 max-w-sm">
                    Earn {summary.settings.minPointsToRedeem - (summary?.balance ?? 0)} more points to unlock redemption at checkout.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xs sm:text-sm md:text-base font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase">
                  History
                </h2>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 md:pb-0">
                  {[
                    { id: FILTERS.ALL, label: "All" },
                    { id: FILTERS.EARN, label: "Earned" },
                    { id: FILTERS.REDEEM, label: "Redeemed" },
                    { id: FILTERS.REFUND, label: "Refunded" },
                  ].map((filter) => {
                    const isSelected = selectedFilter === filter.id
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setSelectedFilter(filter.id)}
                        className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                          isSelected
                            ? "bg-white dark:bg-[#1a1a1a] border-2 border-orange-500 text-orange-600 dark:text-orange-400 shadow-sm"
                            : "bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {filter.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {filteredTransactions.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  {filteredTransactions.map((t) => (
                    <Card
                      key={t.transactionId || t._id}
                      className="py-0 border border-gray-100 dark:border-gray-800 shadow-sm dark:bg-[#1a1a1a]"
                    >
                      <CardContent className="p-4 md:p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
                              {getTransactionIcon(t.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 dark:text-white font-semibold text-sm md:text-base truncate mb-1">
                                {t.description || t.reference || "Loyalty points"}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm">
                                {formatDate(t.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className={`flex-shrink-0 font-bold text-lg md:text-xl ${getTransactionColor(t.type)}`}>
                            {t.type === "redeem" ? "-" : "+"}
                            {Math.abs(t.points)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base text-center font-medium py-12">
                  Your points history will appear here
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AnimatedPage>
  )
}
