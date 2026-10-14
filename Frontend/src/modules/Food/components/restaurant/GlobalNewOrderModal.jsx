import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Printer,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  X,
  AlertCircle,
  Clock,
  Calendar,
  FileText,
  UtensilsCrossed,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { restaurantAPI } from "@food/api";
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications";
import { loadBusinessSettings } from "@food/utils/businessSettings";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const REJECT_REASONS = [
  "Restaurant is too busy",
  "Item not available / Out of stock",
  "Outside delivery area",
  "Kitchen closing soon",
  "Technical issue",
  "Other reason",
];

const formatCountdownTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export default function GlobalNewOrderModal() {
  const {
    newOrder,
    orderQueue,
    clearNewOrder,
    stopAlertLoop,
    playNotificationSound,
  } = useRestaurantNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [countdown, setCountdown] = useState(180);
  const [prepTime, setPrepTime] = useState(15);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState("");
  const [customRejectReason, setCustomRejectReason] = useState("");

  // Swipe to accept state
  const [swipeProgress, setSwipeProgress] = useState(0);
  const sliderRef = useRef(null);
  const swipeStartX = useRef(0);
  const isSwiping = useRef(false);

  // Sync newOrder with modal visibility
  useEffect(() => {
    if (newOrder) {
      // Check if order was already cancelled
      const statusRaw = String(newOrder?.status || newOrder?.orderStatus || "").toLowerCase();
      if (statusRaw.includes("cancel")) {
        clearNewOrder();
        return;
      }

      setActiveOrder(newOrder);
      setIsOpen(true);
      setCountdown(180);
      setPrepTime(15);
      setIsSubmitting(false);
      setShowRejectModal(false);
      setSelectedRejectReason("");
      setCustomRejectReason("");
      setSwipeProgress(0);
    } else {
      setIsOpen(false);
      setActiveOrder(null);
      stopAlertLoop();
    }
  }, [newOrder]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !activeOrder) return;

    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (countdown === 0) {
      // Auto-reject on timeout
      handleAutoReject();
    }
  }, [isOpen, countdown, activeOrder]);

  // Handle external cancellation from socket or poll
  useEffect(() => {
    const handleStatusUpdate = (e) => {
      const updated = e.detail;
      if (!updated || !activeOrder) return;

      const activeId = String(
        activeOrder._id || activeOrder.orderMongoId || activeOrder.orderId || ""
      ).trim();
      const updatedId = String(
        updated._id || updated.orderMongoId || updated.orderId || ""
      ).trim();

      if (activeId && updatedId && activeId === updatedId) {
        const status = String(updated.orderStatus || updated.status || "").toLowerCase();
        if (status.includes("cancel")) {
          toast.error("Order was cancelled by the customer");
          stopAlertLoop();
          clearNewOrder();
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("restaurantOrderStatusUpdate", handleStatusUpdate);
    return () =>
      window.removeEventListener("restaurantOrderStatusUpdate", handleStatusUpdate);
  }, [activeOrder]);

  const resolveOrderId = (order) => {
    return order?._id || order?.orderMongoId || order?.orderId || null;
  };

  const handleAutoReject = async () => {
    const orderId = resolveOrderId(activeOrder);
    if (!orderId || isSubmitting) {
      stopAlertLoop();
      clearNewOrder();
      setIsOpen(false);
      return;
    }

    try {
      setIsSubmitting(true);
      await restaurantAPI.rejectOrder(
        orderId,
        "No response from restaurant (Auto-rejected on timeout)"
      );
      toast.info("Order auto-rejected due to timeout");
      window.dispatchEvent(new CustomEvent("restaurantOrdersRefresh"));
    } catch (err) {
      console.warn("Auto-reject error:", err);
    } finally {
      stopAlertLoop();
      clearNewOrder();
      setIsOpen(false);
      setIsSubmitting(false);
    }
  };

  const handleAcceptOrder = async () => {
    const orderId = resolveOrderId(activeOrder);
    if (!orderId) {
      toast.error("Unable to accept order: Order ID missing");
      return;
    }

    try {
      setIsSubmitting(true);
      stopAlertLoop();
      await restaurantAPI.acceptOrder(orderId, prepTime);
      toast.success(`Order accepted! Prep time: ${prepTime} mins`);
      window.dispatchEvent(new CustomEvent("restaurantOrdersRefresh"));
      clearNewOrder();
      setIsOpen(false);
    } catch (error) {
      console.error("Error accepting order:", error);
      const msg =
        error.response?.data?.message || error.message || "Failed to accept order";
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  const handleOpenRejectModal = () => {
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    const orderId = resolveOrderId(activeOrder);
    const reason =
      selectedRejectReason === "Other reason" && customRejectReason.trim()
        ? customRejectReason.trim()
        : selectedRejectReason;

    if (!reason) {
      toast.error("Please select a reason for rejection");
      return;
    }

    try {
      setIsSubmitting(true);
      stopAlertLoop();
      await restaurantAPI.rejectOrder(orderId, reason);
      toast.info("Order rejected");
      window.dispatchEvent(new CustomEvent("restaurantOrdersRefresh"));
      setShowRejectModal(false);
      clearNewOrder();
      setIsOpen(false);
    } catch (error) {
      console.error("Error rejecting order:", error);
      toast.error(error.response?.data?.message || "Failed to reject order");
      setIsSubmitting(false);
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      playNotificationSound(activeOrder);
    } else {
      setIsMuted(true);
      stopAlertLoop();
    }
  };

  // Thermal Receipt Generator
  const handlePrintReceipt = async () => {
    if (!activeOrder) return;
    try {
      toast.info("Preparing receipt...");
      let settings = {};
      try {
        settings = (await loadBusinessSettings()) || {};
      } catch (err) {}

      let restaurant = {};
      try {
        const resData = await restaurantAPI.getCurrentRestaurant();
        restaurant =
          resData?.data?.data?.restaurant || resData?.data?.restaurant || {};
      } catch (err) {}

      const pricing = activeOrder.pricing || {};
      const items = activeOrder.items || [];
      const itemsTotal = items.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0
      );
      const total = activeOrder.total || pricing.total || itemsTotal;
      const paymentMethod =
        String(
          activeOrder.paymentMethod || activeOrder.payment?.method || "ONLINE"
        ).toUpperCase();

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 200], // 80mm POS slip
      });

      let y = 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(restaurant.name || "RESTAURANT RECEIPT", 40, y, { align: "center" });
      y += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      if (restaurant.address) {
        doc.text(String(restaurant.address).slice(0, 40), 40, y, { align: "center" });
        y += 5;
      }

      doc.setLineDashPattern([1, 1], 0);
      doc.line(5, y, 75, y);
      y += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`ORDER #${activeOrder.orderId || "NEW"}`, 5, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `Date: ${new Date(activeOrder.createdAt || Date.now()).toLocaleString("en-IN")}`,
        5,
        y
      );
      y += 5;
      doc.text(`Payment: ${paymentMethod}`, 5, y);
      y += 5;

      doc.line(5, y, 75, y);
      y += 4;

      const tableData = items.map((it) => [
        `${it.quantity}x ${it.name}`,
        `₹${(it.price || 0) * (it.quantity || 1)}`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Item", "Price"]],
        body: tableData,
        theme: "plain",
        styles: { fontSize: 8, cellPadding: 1 },
        headStyles: { fontStyle: "bold" },
        margin: { left: 5, right: 5 },
      });

      y = doc.lastAutoTable.finalY + 4;
      doc.line(5, y, 75, y);
      y += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("TOTAL AMOUNT:", 5, y);
      doc.text(`₹${Number(total).toFixed(2)}`, 75, y, { align: "right" });
      y += 8;

      if (activeOrder.restaurantNote || activeOrder.note) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text(`Note: ${activeOrder.restaurantNote || activeOrder.note}`, 5, y);
        y += 6;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Thank you for your order!", 40, y, { align: "center" });

      doc.autoPrint();
      window.open(doc.output("bloburl"), "_blank");
    } catch (e) {
      console.error("Print error:", e);
      toast.error("Failed to generate thermal receipt");
    }
  };

  // Mobile Touch Swipe Handlers
  const handleTouchStart = (e) => {
    isSwiping.current = true;
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (!isSwiping.current || !sliderRef.current) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - swipeStartX.current;
    const width = sliderRef.current.offsetWidth - 50;
    const progress = Math.max(0, Math.min(1, diff / width));
    setSwipeProgress(progress);

    if (progress >= 0.9 && !isSubmitting) {
      isSwiping.current = false;
      handleAcceptOrder();
    }
  };

  const handleTouchEnd = () => {
    isSwiping.current = false;
    if (swipeProgress < 0.9) {
      setSwipeProgress(0);
    }
  };

  if (!isOpen || !activeOrder) return null;

  const items = activeOrder.items || [];
  const orderTotal = Number(
    activeOrder.total || activeOrder.pricing?.total || 0
  );
  const rawPayment = String(
    activeOrder.paymentMethod || activeOrder.payment?.method || ""
  ).toLowerCase();
  const isCod = rawPayment === "cash" || rawPayment === "cod";

  const modalJSX = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Countdown Progress Bar */}
        <div className="w-full bg-gray-100 h-2 overflow-hidden">
          <motion.div
            className={`h-full ${
              countdown <= 30
                ? "bg-red-500"
                : countdown <= 60
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            initial={{ width: "100%" }}
            animate={{ width: `${(countdown / 180) * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 font-bold shrink-0 animate-pulse">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-gray-900 tracking-tight">
                  #{activeOrder.orderId || "Order"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 animate-pulse">
                  New Order
                </span>
                {orderQueue.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                    +{orderQueue.length - 1} more
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {activeOrder.restaurantName || "Incoming Order Request"}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className={`p-2.5 rounded-xl border transition-colors ${
                isMuted
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
              title={isMuted ? "Unmute Alarm" : "Mute Alarm"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4 animate-bounce" />
              )}
            </button>

            <button
              onClick={handlePrintReceipt}
              className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
              title="Print Receipt"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Order Details Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Scheduled Order Notification */}
          {activeOrder.scheduledAt && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                  Scheduled Order
                </p>
                <p className="text-xs font-semibold text-emerald-900">
                  Deliver for{" "}
                  {new Date(activeOrder.scheduledAt).toLocaleString("en-IN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Special Instructions / Note */}
          {(activeOrder.restaurantNote || activeOrder.note) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                  Cooking Instructions
                </p>
                <p className="text-xs font-semibold text-amber-950 mt-0.5">
                  "{activeOrder.restaurantNote || activeOrder.note}"
                </p>
              </div>
            </div>
          )}

          {/* Cutlery Preference Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
              activeOrder.sendCutlery === false
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-gray-50 text-gray-700 border border-gray-200"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>
              {activeOrder.sendCutlery === false
                ? "Do NOT include cutlery (Eco-friendly)"
                : "Send cutlery with order"}
            </span>
          </div>

          {/* Items Accordion */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/50">
            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Order Items ({items.length})
                </span>
              </div>
              {isDetailsExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {isDetailsExpanded && (
              <div className="p-4 space-y-3 bg-white border-t border-gray-100">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No item details available</p>
                ) : (
                  items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between text-xs pb-2 border-b border-gray-50 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                            item.isVeg === false
                              ? "border-red-500"
                              : "border-emerald-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.isVeg === false
                                ? "bg-red-500"
                                : "bg-emerald-600"
                            }`}
                          />
                        </span>
                        <div>
                          <p className="font-bold text-gray-900">
                            {item.quantity} × {item.name}
                          </p>
                          {item.variant && (
                            <p className="text-[11px] text-gray-500">{item.variant}</p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <p className="text-[10px] text-gray-400">
                              + {item.addons.map((a) => a.name).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-gray-900 ml-3">
                        ₹{(item.price || 0) * (item.quantity || 1)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Payment Mode & Total Bill */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Payment Mode
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCod ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
                <span
                  className={`text-xs font-bold ${
                    isCod ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {isCod ? "Cash on Delivery" : "Online Paid"}
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Total Bill
              </p>
              <p className="text-lg font-black text-gray-900">
                ₹{Number(orderTotal).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Preparation Time Adjuster */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-950">
                Kitchen Prep Time
              </p>
              <p className="text-[11px] text-indigo-700/80">
                Time required before rider pickup
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl border border-indigo-200/80 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setPrepTime(Math.max(5, prepTime - 5))}
                disabled={isSubmitting}
                className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-colors disabled:opacity-50"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="w-14 text-center text-xs font-black text-gray-900">
                {prepTime} mins
              </span>

              <button
                type="button"
                onClick={() => setPrepTime(Math.min(90, prepTime + 5))}
                disabled={isSubmitting}
                className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-5 border-t border-gray-100 bg-white space-y-2.5">
          {/* Mobile Swipe Slider */}
          <div
            ref={sliderRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="sm:hidden relative h-13 rounded-2xl bg-gray-900 flex items-center overflow-hidden cursor-pointer shadow-md select-none"
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-blue-600 transition-all duration-75"
              style={{ width: `${swipeProgress * 100}%` }}
            />
            <div className="w-full text-center text-white text-xs font-bold tracking-wide z-10 pointer-events-none">
              {isSubmitting
                ? "Accepting Order..."
                : `Slide to Accept (${formatCountdownTime(countdown)})`}
            </div>
            <motion.div
              className="absolute left-1.5 w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-900 shadow-md z-20"
              style={{
                x: swipeProgress * ((sliderRef.current?.offsetWidth || 300) - 52),
              }}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </motion.div>
          </div>

          {/* Desktop & Alternate Accept Button */}
          <button
            onClick={handleAcceptOrder}
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm tracking-wide shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting
                ? "Accepting Order..."
                : `ACCEPT ORDER (${formatCountdownTime(countdown)})`}
            </span>
          </button>

          {/* Reject Order Button */}
          <button
            onClick={handleOpenRejectModal}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold tracking-wide transition-colors disabled:opacity-50"
          >
            REJECT ORDER
          </button>
        </div>
      </motion.div>

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div
            className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60"
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-black text-gray-900 mb-1">
                Reject Order #{activeOrder?.orderId || ""}
              </h3>
              <p className="text-xs text-gray-500 mb-4 font-medium">
                Please select why you cannot accept this order:
              </p>

              <div className="space-y-2 mb-4">
                {REJECT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedRejectReason(reason)}
                    className={`w-full p-2.5 text-left text-xs font-semibold rounded-xl border transition-colors ${
                      selectedRejectReason === reason
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {selectedRejectReason === "Other reason" && (
                <textarea
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={2}
                  className="w-full p-2.5 text-xs border border-gray-200 rounded-xl mb-4 focus:outline-none focus:border-red-500"
                />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={!selectedRejectReason || isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Rejecting..." : "Confirm Reject"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalJSX, document.body)
    : null;
}
