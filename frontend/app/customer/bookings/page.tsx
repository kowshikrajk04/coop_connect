"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Calendar, Clock, CheckCircle2, AlertTriangle, Star, 
  CreditCard, FileText, ChevronRight, X, Phone, User, 
  ShieldCheck, Printer, ArrowRight, RefreshCw
} from "lucide-react";
import { api } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/razorpay";

export default function CustomerBookingsPage() {
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [previousBookings, setPreviousBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Payment Modal
  const [paymentModalBooking, setPaymentModalBooking] = useState<any>(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any | null>(null);

  // Invoice Modal
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  // Rating Modal
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [selectedStars, setSelectedStars] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await api.customer.getBookings();
      setActiveBookings(res.active || []);
      setPreviousBookings(res.previous || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPayment = async (booking: any) => {
    setPaymentError(null);
    setPaymentSuccessData(null);
    try {
      const bd = await api.payments.getBreakdown(booking.id);
      setPaymentBreakdown(bd);
      setPaymentModalBooking(booking);
    } catch (err: any) {
      alert(err.message || "Could not load breakdown");
    }
  };

  const handleInitiateRazorpay = async () => {
    if (!paymentModalBooking) return;
    setIsPaying(true);
    setPaymentError(null);

    try {
      // 1. Ensure Razorpay Checkout script is loaded
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Razorpay Checkout SDK failed to load. Please verify your internet connection.");
      }

      // 2. Create order on backend (amount converted to paise server-side)
      const orderData = await api.payments.createOrder(
        paymentModalBooking.id,
        paymentModalBooking.total_amount
      );

      // 3. Launch Razorpay Checkout Modal (Supports UPI, Card, Net Banking)
      const options = {
        key: orderData.key_id,
        amount: orderData.amount, // in paise
        currency: orderData.currency || "INR",
        name: "CoopConnect",
        description: `Cooperative Payment for ${paymentModalBooking.service_type} (#${paymentModalBooking.booking_number})`,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          try {
            setIsPaying(true);
            const verifyRes = await api.payments.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              booking_id: paymentModalBooking.id,
            });

            setPaymentSuccessData({
              payment_id: response.razorpay_payment_id,
              order_id: response.razorpay_order_id,
              amount: verifyRes.amount || paymentModalBooking.total_amount,
              booking_id: paymentModalBooking.id,
            });
            setPaymentError(null);
            fetchBookings();
          } catch (verifyErr: any) {
            setPaymentError(verifyErr.message || "Payment signature verification failed. Please try again.");
          } finally {
            setIsPaying(false);
          }
        },
        prefill: {
          name: paymentModalBooking.customer_name || "Cooperative Customer",
          email: "customer@coopconnect.org",
          contact: "9876543210",
        },
        theme: {
          color: "#2563EB",
        },
        modal: {
          ondismiss: function () {
            setIsPaying(false);
            if (!paymentSuccessData) {
              setPaymentError("Payment was cancelled. Booking remains unpaid.");
            }
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (failResponse: any) {
        console.error("Razorpay payment.failed event payload:", failResponse);
        setIsPaying(false);
        const err = failResponse?.error || {};
        const errorDetails = [
          err.description,
          err.reason ? `(Reason: ${err.reason})` : "",
          err.code ? `[Code: ${err.code}]` : "",
          err.source ? `[Source: ${err.source}]` : "",
          err.step ? `[Step: ${err.step}]` : "",
        ].filter(Boolean).join(" ");
        setPaymentError(errorDetails || "Payment Failed. Please try again.");
      });
      rzp.open();
    } catch (err: any) {
      setPaymentError(err.message || "Failed to initialize Razorpay checkout. Please try again.");
    } finally {
      setIsPaying(false);
    }
  };

  const handleViewInvoice = async (bookingId: number) => {
    try {
      const inv = await api.payments.getInvoice(bookingId);
      setInvoiceData(inv);
      setIsInvoiceOpen(true);
    } catch (err: any) {
      alert(err.message || "Invoice not available");
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBooking) return;
    setIsSubmittingRating(true);
    try {
      const res = await api.feedback.submit(ratingBooking.id, selectedStars, ratingFeedback);
      alert(res.message || "Thank you for your feedback.");
      // Optimistically mark as rated
      const updateList = (list: any[]) =>
        list.map((item) => (item.id === ratingBooking.id ? { ...item, has_rated: true } : item));
      setActiveBookings((prev) => updateList(prev));
      setPreviousBookings((prev) => updateList(prev));
      setRatingBooking(null);
      setRatingFeedback("");
      setSelectedStars(5);
      fetchBookings();
    } catch (err: any) {
      alert(err.message || "Failed to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Bookings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track service status, verify completion, pay with transparent breakdowns, and rate workers
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading your bookings...</div>
      ) : activeBookings.length === 0 && previousBookings.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">No bookings yet</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2 mb-6">
            You have not created any service bookings yet. Request an electrician, plumber, carpenter or other verified worker.
          </p>
          <Link
            href="/customer/dashboard"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition inline-flex items-center gap-2"
          >
            <span>Book a Service</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Bookings */}
          {activeBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Active Bookings ({activeBookings.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeBookings.map((b) => (
                  <div key={b.id} className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-mono text-gray-400">#{b.booking_number}</span>
                        <h3 className="text-lg font-bold text-gray-900">{b.service_type}</h3>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {b.status}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600">{b.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-gray-400 block text-[10px]">SCHEDULE</span>
                        <span className="font-medium text-gray-800">{b.scheduled_date} ({b.scheduled_time})</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">ADDRESS</span>
                        <span className="font-medium text-gray-800 truncate block">{b.customer_address}</span>
                      </div>
                    </div>

                    {b.worker && (
                      <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                            {b.worker.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{b.worker.name}</p>
                            <span className="text-gray-500">📞 +91 {b.worker.mobile}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            {b.worker.rating}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      <div>
                        <span className="text-gray-400 block text-[10px]">TOTAL AMOUNT</span>
                        <span className="font-bold text-gray-900 text-sm">₹{b.total_amount}</span>
                      </div>
                      {!b.has_paid ? (
                        <button
                          onClick={() => handleOpenPayment(b)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay Now</span>
                        </button>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          PAID
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Previous / Completed Bookings */}
          {previousBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Completed Services ({previousBookings.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {previousBookings.map((b) => (
                  <div key={b.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-mono text-gray-400">#{b.booking_number}</span>
                        <h3 className="text-base font-bold text-gray-900">{b.service_type}</h3>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {b.status}
                      </span>
                    </div>

                    {/* Completion proof thumbnail */}
                    {b.completion_photo_url && (
                      <div className="p-2.5 bg-gray-50 rounded-xl flex items-center gap-3">
                        <img
                          src={b.completion_photo_url}
                          alt="Completion proof"
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-gray-900 block">Service Completion Proof</span>
                          <span className="text-emerald-700">Verified by worker on-site</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      <div>
                        <span className="text-gray-400 block text-[10px]">TOTAL AMOUNT</span>
                        <span className="font-bold text-gray-900 text-sm">₹{b.total_amount}</span>
                      </div>

                      {/* Action buttons based on payment / rating state */}
                      <div className="flex items-center gap-2">
                        {!b.has_paid ? (
                          <button
                            onClick={() => handleOpenPayment(b)}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Now</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleViewInvoice(b.id)}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5 text-gray-500" />
                              <span>Invoice</span>
                            </button>

                            {!b.has_rated && (
                              <button
                                onClick={() => setRatingBooking(b)}
                                className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1"
                              >
                                <Star className="w-3.5 h-3.5 fill-amber-500" />
                                <span>Rate Worker</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RAZORPAY TEST MODE PAYMENT MODAL */}
      {paymentModalBooking && paymentBreakdown && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative border border-gray-200">
            <button
              onClick={() => {
                setPaymentModalBooking(null);
                setPaymentSuccessData(null);
                setPaymentError(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            {paymentSuccessData ? (
              /* PAYMENT SUCCESSFUL VIEW */
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold text-gray-900">Payment Successful</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Your payment was verified and processed securely via Razorpay.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl text-left text-xs space-y-2 border border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transaction ID:</span>
                    <span className="font-mono font-bold text-gray-900 truncate max-w-[200px]">
                      {paymentSuccessData.payment_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Razorpay Order ID:</span>
                    <span className="font-mono text-gray-700 truncate max-w-[200px]">
                      {paymentSuccessData.order_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount Paid:</span>
                    <span className="font-bold text-emerald-700">₹{paymentSuccessData.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      PAID (Verified)
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => {
                      const bId = paymentSuccessData.booking_id;
                      setPaymentModalBooking(null);
                      setPaymentSuccessData(null);
                      handleViewInvoice(bId);
                    }}
                    className="w-1/2 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span>View Invoice</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentModalBooking(null);
                      setPaymentSuccessData(null);
                    }}
                    className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* TRANSPARENT BREAKDOWN & CHECKOUT INITIATION */
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Cooperative Payment</h3>
                  <p className="text-xs text-gray-500">100% Transparent Fee Distribution</p>
                </div>

                {/* Transparent Breakdown */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-xs border border-gray-200">
                  <div className="flex justify-between text-gray-700">
                    <span>Service Charge ({paymentBreakdown.service_type}):</span>
                    <span className="font-semibold text-gray-900">₹{paymentBreakdown.service_amount}</span>
                  </div>

                  <div className="flex justify-between text-gray-600 pt-2 border-t border-gray-200">
                    <span>Worker Take-home Payout (90%):</span>
                    <span className="font-semibold text-emerald-700">₹{paymentBreakdown.worker_payout}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Cooperative Service Fee (10%):</span>
                    <span className="font-semibold text-gray-700">₹{paymentBreakdown.coop_fee}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Member Welfare Reserve ({paymentBreakdown.welfare_pct}%):</span>
                    <span className="font-semibold text-blue-700">₹{paymentBreakdown.welfare_contribution}</span>
                  </div>

                  <div className="flex justify-between font-bold text-sm text-gray-900 pt-2 border-t border-gray-300">
                    <span>Total Payable:</span>
                    <span>₹{paymentBreakdown.total_amount}</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 text-blue-900 text-[11px] rounded-xl leading-relaxed">
                  <strong>Cooperative Guarantee:</strong> ₹{paymentBreakdown.welfare_contribution} is credited directly to the member's healthcare and welfare reserve.
                </div>

                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-500">
                  <span className="font-medium text-gray-700">Razorpay Secure Payment</span>
                  <span className="text-gray-500">UPI • Card • Net Banking</span>
                </div>

                {/* Inline error / Payment Failed banner */}
                {paymentError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Payment Failed</span>
                      <span>{paymentError}</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModalBooking(null);
                      setPaymentError(null);
                    }}
                    className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-xs hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInitiateRazorpay}
                    disabled={isPaying}
                    className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {isPaying
                        ? "Opening Razorpay..."
                        : paymentError
                        ? "Try Again"
                        : `Pay Now (₹${paymentBreakdown.total_amount})`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIGITAL INVOICE MODAL */}
      {isInvoiceOpen && invoiceData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-xl relative my-8 border border-gray-200">
            <button
              onClick={() => setIsInvoiceOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Invoice Header */}
            <div className="border-b-2 border-gray-900 pb-4 mb-6 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">CoopConnect</h3>
                <p className="text-xs text-gray-600 font-medium">Digital Cooperative Invoice</p>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  {invoiceData.coop_name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-gray-900">{invoiceData.invoice_number}</span>
                <p className="text-[11px] text-gray-500">{invoiceData.issued_date}</p>
              </div>
            </div>

            {/* Bill Details */}
            <div className="grid grid-cols-2 gap-4 text-xs mb-6 pb-6 border-b border-gray-100">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Billed To</span>
                <p className="font-bold text-gray-900 text-sm">{invoiceData.customer_name}</p>
                <span className="text-gray-500">Booking #{invoiceData.booking_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Service Provider</span>
                <p className="font-bold text-gray-900 text-sm">{invoiceData.worker_name}</p>
                <span className="text-emerald-700 font-medium">Verified Cooperative Member</span>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2 text-xs mb-6">
              <div className="flex justify-between py-1.5 border-b border-gray-100 font-semibold text-gray-700">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between py-1 text-gray-800">
                <span>Service Charge ({invoiceData.service_type})</span>
                <span>₹{invoiceData.breakdown.service_amount}</span>
              </div>
              <div className="flex justify-between py-1 text-gray-500">
                <span>- Worker Payout</span>
                <span>₹{invoiceData.breakdown.worker_payout}</span>
              </div>
              <div className="flex justify-between py-1 text-gray-500">
                <span>- Welfare Fund Contribution</span>
                <span>₹{invoiceData.breakdown.welfare_contribution}</span>
              </div>
              <div className="flex justify-between py-1 text-gray-500">
                <span>- Cooperative Service Fee</span>
                <span>₹{invoiceData.breakdown.coop_fee}</span>
              </div>
              <div className="flex justify-between pt-3 border-t-2 border-gray-900 font-bold text-base text-gray-900">
                <span>Total Paid:</span>
                <span>₹{invoiceData.total_amount}</span>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl text-[10px] text-gray-500 text-center mb-6">
              Transaction Ref: {invoiceData.breakdown.transaction_id} • Method: {invoiceData.breakdown.payment_method}
            </div>

            <div className="flex justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setIsInvoiceOpen(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RATING MODAL */}
      {ratingBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl relative text-center">
            <button
              onClick={() => setRatingBooking(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6 fill-amber-400" />
            </div>

            <h3 className="text-lg font-bold text-gray-900">Rate Your Service</h3>
            <p className="text-xs text-gray-500 mt-1">
              How was the workmanship of <strong>{ratingBooking.worker?.name || "the worker"}</strong>?
            </p>

            <div className="flex items-center justify-center gap-2 my-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedStars(star)}
                  className="p-1 text-2xl focus:outline-none"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= selectedStars
                        ? "text-amber-400 fill-amber-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={ratingFeedback}
              onChange={(e) => setRatingFeedback(e.target.value)}
              placeholder="Leave optional praise or feedback for the cooperative board..."
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500 mb-4"
            />

            <button
              onClick={handleSubmitRating}
              disabled={isSubmittingRating}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition"
            >
              {isSubmittingRating ? "Submitting..." : "Submit Rating"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
