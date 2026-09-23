"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Star,
  CreditCard,
  FileText,
  X,
  Printer,
  ArrowRight,
  RefreshCw,
  MapPin,
  Navigation,
  Truck,
  Home,
  Wrench,
  DollarSign,
  User,
} from "lucide-react";

import { api } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/razorpay";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Booking Status Timeline
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TIMELINE_STEPS = [
  {
    key: "REQUESTED",
    label: "Requested",
    icon: Calendar,
  },
  {
    key: "ALLOCATED",
    label: "Assigned",
    icon: User,
  },
  {
    key: "ACCEPTED",
    label: "Accepted",
    icon: CheckCircle2,
  },
  {
    key: "ON_THE_WAY",
    label: "On The Way",
    icon: Truck,
  },
  {
    key: "ARRIVED",
    label: "Arrived",
    icon: Home,
  },
  {
    key: "IN_PROGRESS",
    label: "In Progress",
    icon: Wrench,
  },
  {
    key: "COMPLETED",
    label: "Completed",
    icon: DollarSign,
  },
];

const STATUS_ORDER: Record<string, number> = Object.fromEntries(
  TIMELINE_STEPS.map((step, index) => [step.key, index])
);

function BookingTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER[status] ?? 0;

  return (
    <div className="w-full overflow-x-auto py-1">
      <div className="flex items-center min-w-max gap-0">
        {TIMELINE_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition ${
                    done
                      ? "bg-blue-600 border-blue-600 text-white"
                      : active
                      ? "bg-white border-blue-600 text-blue-600"
                      : "bg-white border-gray-200 text-gray-300"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <span
                  className={`text-[10px] font-semibold whitespace-nowrap ${
                    done
                      ? "text-blue-600"
                      : active
                      ? "text-blue-700"
                      : "text-gray-300"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {idx < TIMELINE_STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-6 mx-0.5 mb-4 rounded transition ${
                    idx < currentIdx ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Page
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function CustomerBookingsPage() {
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [previousBookings, setPreviousBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Payment Modal
  const [paymentModalBooking, setPaymentModalBooking] = useState<any>(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any | null>(
    null
  );
  const [paymentTab, setPaymentTab] = useState<"CARD" | "QR">("CARD");
  const [qrData, setQrData] = useState<any>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);

  // Invoice Modal
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

  // Rating Modal
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [selectedStars, setSelectedStars] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Fetch bookings
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setIsLoading(true);

    try {
      const res = await api.customer.getBookings();

      setActiveBookings(res.active || []);
      setPreviousBookings(res.previous || []);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Payment
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleOpenPayment = async (booking: any) => {
    setPaymentError(null);
    setPaymentSuccessData(null);
    setQrData(null);
    setPaymentTab("CARD");

    try {
      const breakdown = await api.payments.getBreakdown(booking.id);

      setPaymentBreakdown(breakdown);
      setPaymentModalBooking(booking);
    } catch (error: any) {
      alert(error?.message || "Could not load payment breakdown");
    }
  };

  const handleInitiateRazorpay = async () => {
    if (!paymentModalBooking) {
      return;
    }

    setIsPaying(true);
    setPaymentError(null);

    try {
      // 1. Load Razorpay Checkout SDK
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        throw new Error(
          "Razorpay Checkout SDK failed to load. Please verify your internet connection."
        );
      }

      // 2. Create Razorpay order on backend
      const orderData = await api.payments.createOrder(
        paymentModalBooking.id,
        paymentModalBooking.total_amount
      );

      // 3. Razorpay checkout options
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
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
              amount:
                verifyRes.amount || paymentModalBooking.total_amount,
              booking_id: paymentModalBooking.id,
            });

            setPaymentError(null);

            await fetchBookings();
          } catch (verifyError: any) {
            setPaymentError(
              verifyError?.message ||
                "Payment signature verification failed. Please try again."
            );
          } finally {
            setIsPaying(false);
          }
        },

        prefill: {
          name:
            paymentModalBooking.customer_name ||
            "Cooperative Customer",
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
              setPaymentError(
                "Payment was cancelled. Booking remains unpaid."
              );
            }
          },
        },
      };

      const Razorpay = (window as any).Razorpay;

      if (!Razorpay) {
        throw new Error(
          "Razorpay Checkout is not available. Please refresh the page."
        );
      }

      const rzp = new Razorpay(options);

      rzp.on("payment.failed", function (failResponse: any) {
        console.error(
          "Razorpay payment.failed event payload:",
          failResponse
        );

        setIsPaying(false);

        const error = failResponse?.error || {};

        const errorDetails = [
          error.description,
          error.reason ? `(Reason: ${error.reason})` : "",
          error.code ? `[Code: ${error.code}]` : "",
          error.source ? `[Source: ${error.source}]` : "",
          error.step ? `[Step: ${error.step}]` : "",
        ]
          .filter(Boolean)
          .join(" ");

        setPaymentError(
          errorDetails || "Payment failed. Please try again."
        );
      });

      rzp.open();
    } catch (error: any) {
      setPaymentError(
        error?.message ||
          "Failed to initialize Razorpay checkout. Please try again."
      );
    } finally {
      setIsPaying(false);
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Invoice
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleViewInvoice = async (bookingId: number) => {
    try {
      const invoice = await api.payments.getInvoice(bookingId);

      setInvoiceData(invoice);
      setIsInvoiceOpen(true);
    } catch (error: any) {
      alert(error?.message || "Invoice not available");
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Rating
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ratingBooking) {
      return;
    }

    setIsSubmittingRating(true);

    try {
      const response = await api.feedback.submit(
        ratingBooking.id,
        selectedStars,
        ratingFeedback
      );

      alert(response.message || "Thank you for your feedback.");

      const updateList = (list: any[]) =>
        list.map((item) =>
          item.id === ratingBooking.id
            ? { ...item, has_rated: true }
            : item
        );

      setActiveBookings((prev) => updateList(prev));
      setPreviousBookings((prev) => updateList(prev));

      setRatingBooking(null);
      setRatingFeedback("");
      setSelectedStars(5);

      await fetchBookings();
    } catch (error: any) {
      alert(error?.message || "Failed to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Render
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          My Bookings
        </h1>

        <p className="text-sm text-gray-500 mt-1">
          Track service status, verify completion, pay with transparent
          breakdowns, and rate workers
        </p>
      </div>

      {/* Loading */}

      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-400">
          Loading your bookings...
        </div>
      ) : activeBookings.length === 0 &&
        previousBookings.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold text-gray-900">
            No bookings yet
          </h2>

          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2 mb-6">
            You have not created any service bookings yet. Request an
            electrician, plumber, carpenter or other verified worker.
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
          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {/* Active Bookings */}
          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

          {activeBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">
                Active Bookings ({activeBookings.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-sm space-y-4"
                  >
                    {/* Header */}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-mono text-gray-400">
                          #{booking.booking_number}
                        </span>

                        <h3 className="text-lg font-bold text-gray-900">
                          {booking.service_type}
                        </h3>
                      </div>

                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {booking.status}
                      </span>
                    </div>

                    {/* Description */}

                    <p className="text-xs text-gray-600">
                      {booking.description}
                    </p>

                    {/* Timeline */}

                    <div className="pt-2 border-t border-gray-100">
                      <BookingTimeline status={booking.status} />
                    </div>

                    {/* Schedule / Address */}

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-gray-400 block text-[10px]">
                          SCHEDULE
                        </span>

                        <span className="font-medium text-gray-800">
                          {booking.scheduled_date} (
                          {booking.scheduled_time})
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-400 block text-[10px]">
                          ADDRESS
                        </span>

                        <span className="font-medium text-gray-800 truncate block">
                          {booking.customer_address}
                        </span>
                      </div>
                    </div>

                    {/* Location Link */}

                    {booking.customer_lat &&
                      booking.customer_lng && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${booking.customer_lat},${booking.customer_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-700 text-[11px] font-semibold transition"
                        >
                          <MapPin className="w-3 h-3" />
                          View Service Location on Map
                        </a>
                      )}

                    {/* Worker */}

                    {booking.worker && (
                      <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                            {booking.worker.name?.charAt(0) || "W"}
                          </div>

                          <div>
                            <p className="font-semibold text-gray-900">
                              {booking.worker.name}
                            </p>

                            <span className="text-gray-500">
                              ðŸ“ž +91 {booking.worker.mobile}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            {booking.worker.rating}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Live Location Map */}

                    {booking.customer_lat &&
                      booking.customer_lng && (
                        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700">
                              <MapPin className="w-3.5 h-3.5 text-blue-600" />
                              <span>Live Location Map</span>
                            </div>

                            <div className="flex items-center gap-3 text-[10px] text-gray-500">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                                Your Location
                              </span>

                              {booking.worker?.latitude &&
                                booking.worker?.longitude && (
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                                    Worker
                                  </span>
                                )}
                            </div>
                          </div>

                          <iframe
                            title={`Map for booking ${booking.booking_number}`}
                            width="100%"
                            height="200"
                            style={{ border: 0 }}
                            loading="lazy"
                            src={(() => {
                              const cLat = Number(
                                booking.customer_lat
                              );
                              const cLng = Number(
                                booking.customer_lng
                              );

                              const wLat = booking.worker?.latitude
                                ? Number(booking.worker.latitude)
                                : null;

                              const wLng = booking.worker?.longitude
                                ? Number(booking.worker.longitude)
                                : null;

                              if (
                                wLat !== null &&
                                wLng !== null
                              ) {
                                const minLat =
                                  Math.min(cLat, wLat) - 0.01;
                                const maxLat =
                                  Math.max(cLat, wLat) + 0.01;
                                const minLng =
                                  Math.min(cLng, wLng) - 0.01;
                                const maxLng =
                                  Math.max(cLng, wLng) + 0.01;

                                return (
                                  `https://www.openstreetmap.org/export/embed.html?` +
                                  `bbox=${minLng},${minLat},${maxLng},${maxLat}` +
                                  `&layer=mapnik&marker=${cLat},${cLng}`
                                );
                              }

                              return (
                                `https://www.openstreetmap.org/export/embed.html?` +
                                `bbox=${cLng - 0.01},${cLat - 0.01},` +
                                `${cLng + 0.01},${cLat + 0.01}` +
                                `&layer=mapnik&marker=${cLat},${cLng}`
                              );
                            })()}
                          />

                          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${booking.customer_lat},${booking.customer_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <MapPin className="w-3 h-3" />
                              Open in Google Maps
                            </a>

                            {booking.worker?.latitude &&
                              booking.worker?.longitude && (
                                <a
                                  href={`https://www.google.com/maps/dir/${booking.worker.latitude},${booking.worker.longitude}/${booking.customer_lat},${booking.customer_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                                >
                                  <Navigation className="w-3 h-3" />
                                  Worker Route
                                </a>
                              )}
                          </div>
                        </div>
                      )}

                    {/* Amount / Actions */}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs gap-3">
                      <div>
                        <span className="text-gray-400 block text-[10px]">
                          TOTAL AMOUNT
                        </span>

                        <span className="font-bold text-gray-900 text-sm">
                          ₹{booking.total_amount}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Find Worker */}

                        {booking.status === "REQUESTED" && (
                          <button
                            onClick={async () => {
                              try {
                                const response =
                                  await api.bookings.reallocate(
                                    booking.id
                                  );

                                alert(response.message);
                                await fetchBookings();
                              } catch (error: any) {
                                alert(
                                  error?.message ||
                                    "Failed to find worker"
                                );
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Find Worker</span>
                          </button>
                        )}

                        {/* Pay */}

                        {!booking.has_paid &&
                          booking.status !== "REQUESTED" && (
                            <button
                              onClick={() =>
                                handleOpenPayment(booking)
                              }
                              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Pay Now</span>
                            </button>
                          )}

                        {/* Paid */}

                        {booking.has_paid && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            PAID
                          </span>
                        )}

                        {/* Cancel */}

                        {!booking.has_paid &&
                          [
                            "REQUESTED",
                            "ALLOCATED",
                            "ACCEPTED",
                          ].includes(booking.status) && (
                            <button
                              onClick={async () => {
                                if (
                                  !confirm(
                                    `Cancel booking #${booking.booking_number}? This cannot be undone.`
                                  )
                                ) {
                                  return;
                                }

                                try {
                                  await api.bookings.cancel(
                                    booking.id
                                  );

                                  await fetchBookings();
                                } catch (error: any) {
                                  alert(
                                    error?.message ||
                                      "Failed to cancel"
                                  );
                                }
                              }}
                              className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs flex items-center gap-1 transition"
                            >
                              <X className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {/* Previous / Completed Bookings */}
          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

          {previousBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">
                Completed Services ({previousBookings.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {previousBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
                  >
                    {/* Header */}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-mono text-gray-400">
                          #{booking.booking_number}
                        </span>

                        <h3 className="text-base font-bold text-gray-900">
                          {booking.service_type}
                        </h3>
                      </div>

                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {booking.status}
                      </span>
                    </div>

                    {/* Completion proof */}

                    {booking.completion_photo_url && (
                      <div className="p-2.5 bg-gray-50 rounded-xl flex items-center gap-3">
                        <img
                          src={booking.completion_photo_url}
                          alt="Completion proof"
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                        />

                        <div className="text-xs">
                          <span className="font-semibold text-gray-900 block">
                            Service Completion Proof
                          </span>

                          <span className="text-emerald-700">
                            Verified by worker on-site
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Location */}

                    {booking.customer_lat &&
                      booking.customer_lng && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${booking.customer_lat},${booking.customer_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-700 text-[11px] font-semibold transition"
                        >
                          <MapPin className="w-3 h-3" />
                          View Service Location on Map
                        </a>
                      )}

                    {/* Amount / Actions */}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs gap-3">
                      <div>
                        <span className="text-gray-400 block text-[10px]">
                          TOTAL AMOUNT
                        </span>

                        <span className="font-bold text-gray-900 text-sm">
                          ₹{booking.total_amount}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!booking.has_paid ? (
                          <button
                            onClick={() =>
                              handleOpenPayment(booking)
                            }
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Now</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                handleViewInvoice(booking.id)
                              }
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5 text-gray-500" />
                              <span>Invoice</span>
                            </button>

                            {!booking.has_rated && (
                              <button
                                onClick={() =>
                                  setRatingBooking(booking)
                                }
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

      {/* ================================================================== */}
      {/* PAYMENT MODAL */}
      {/* ================================================================== */}

      {paymentModalBooking && paymentBreakdown && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative border border-gray-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setPaymentModalBooking(null);
                setPaymentSuccessData(null);
                setPaymentError(null);
                setQrData(null);
                setPaymentTab("CARD");
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Payment Success */}

            {paymentSuccessData ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-2xl font-extrabold text-gray-900">
                    Payment Successful
                  </h3>

                  <p className="text-xs text-gray-500 mt-1">
                    Your payment was verified and processed securely
                    via Razorpay.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl text-left text-xs space-y-2 border border-gray-200">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">
                      Transaction ID:
                    </span>

                    <span className="font-mono font-bold text-gray-900 truncate max-w-[200px]">
                      {paymentSuccessData.payment_id}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">
                      Razorpay Order ID:
                    </span>

                    <span className="font-mono text-gray-700 truncate max-w-[200px]">
                      {paymentSuccessData.order_id}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Amount Paid:
                    </span>

                    <span className="font-bold text-emerald-700">
                      ₹{paymentSuccessData.amount}
                    </span>
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
                      const bookingId =
                        paymentSuccessData.booking_id;

                      setPaymentModalBooking(null);
                      setPaymentSuccessData(null);

                      handleViewInvoice(bookingId);
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
              /* Payment Checkout */
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <CreditCard className="w-6 h-6" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900">
                    Cooperative Payment
                  </h3>

                  <p className="text-xs text-gray-500">
                    100% Transparent Fee Distribution
                  </p>
                </div>

                {/* Payment Tabs */}

                <div className="flex rounded-xl bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentTab("CARD")}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      paymentTab === "CARD"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    ðŸ’³ Card / UPI / Net Banking
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setPaymentTab("QR");

                      if (!qrData && paymentModalBooking) {
                        setIsLoadingQR(true);
                        setPaymentError(null);

                        try {
                          const response =
                            await api.payments.getQR(
                              paymentModalBooking.id
                            );

                          setQrData(response);
                        } catch (error: any) {
                          setPaymentError(
                            error?.message ||
                              "Failed to generate QR"
                          );
                        } finally {
                          setIsLoadingQR(false);
                        }
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      paymentTab === "QR"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    ðŸ“± Scan QR Code
                  </button>
                </div>

                {/* QR Payment */}

                {paymentTab === "QR" ? (
                  <div className="text-center space-y-3">
                    {isLoadingQR ? (
                      <div className="py-8 text-sm text-gray-400">
                        Generating QR code...
                      </div>
                    ) : qrData ? (
                      <>
                        <p className="text-xs text-gray-600">
                          Scan with any UPI app (PhonePe, GPay,
                          Paytm)
                        </p>

                        <div className="flex justify-center">
                          <img
                            src={qrData.qr_code_url}
                            alt="Payment QR Code"
                            className="w-48 h-48 border-2 border-gray-200 rounded-2xl p-2 object-contain"
                          />
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Amount:
                            </span>

                            <span className="font-bold text-gray-900">
                              ₹{qrData.amount}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Booking:
                            </span>

                            <span className="font-mono text-gray-700">
                              #{qrData.booking_number}
                            </span>
                          </div>
                        </div>

                        {qrData.payment_link && (
                          <a
                            href={qrData.payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
                          >
                            ðŸ”— Open Payment Link
                          </a>
                        )}

                        <button
                          onClick={() => setPaymentTab("CARD")}
                          className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50"
                        >
                          Switch to Card / Razorpay
                        </button>
                      </>
                    ) : (
                      <div className="py-6 text-sm text-gray-400">
                        Could not load QR. Try Card payment.
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Breakdown */}

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-xs border border-gray-200">
                      <div className="flex justify-between text-gray-700">
                        <span>
                          Service Charge (
                          {paymentBreakdown.service_type}):
                        </span>

                        <span className="font-semibold text-gray-900">
                          ₹{paymentBreakdown.service_amount}
                        </span>
                      </div>

                      <div className="flex justify-between text-gray-600 pt-2 border-t border-gray-200">
                        <span>
                          Worker Take-home Payout (90%):
                        </span>

                        <span className="font-semibold text-emerald-700">
                          ₹{paymentBreakdown.worker_payout}
                        </span>
                      </div>

                      <div className="flex justify-between text-gray-600">
                        <span>
                          Cooperative Service Fee (10%):
                        </span>

                        <span className="font-semibold text-gray-700">
                          ₹{paymentBreakdown.coop_fee}
                        </span>
                      </div>

                      <div className="flex justify-between text-gray-600">
                        <span>
                          Member Welfare Reserve (
                          {paymentBreakdown.welfare_pct}%):
                        </span>

                        <span className="font-semibold text-blue-700">
                          ₹{paymentBreakdown.welfare_contribution}
                        </span>
                      </div>

                      <div className="flex justify-between font-bold text-sm text-gray-900 pt-2 border-t border-gray-300">
                        <span>Total Payable:</span>

                        <span>
                          ₹{paymentBreakdown.total_amount}
                        </span>
                      </div>
                    </div>

                    {/* Guarantee */}

                    <div className="p-3 bg-blue-50 text-blue-900 text-[11px] rounded-xl leading-relaxed">
                      <strong>Cooperative Guarantee:</strong>{" "}
                      ₹{paymentBreakdown.welfare_contribution} is
                      credited directly to the member&apos;s
                      healthcare and welfare reserve.
                    </div>

                    {/* Secure Payment */}

                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-500">
                      <span className="font-medium text-gray-700">
                        Razorpay Secure Payment
                      </span>

                      <span className="text-gray-500">
                        UPI â€¢ Card â€¢ Net Banking
                      </span>
                    </div>

                    {/* Error */}

                    {paymentError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />

                        <div>
                          <span className="font-bold block">
                            Payment Failed
                          </span>

                          <span>{paymentError}</span>
                        </div>
                      </div>
                    )}

                    {/* Buttons */}

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
                        type="button"
                        onClick={handleInitiateRazorpay}
                        disabled={isPaying}
                        className="w-2/3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* DIGITAL INVOICE MODAL */}
      {/* ================================================================== */}

      {isInvoiceOpen && invoiceData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-xl relative my-8 border border-gray-200">
            <button
              onClick={() => setIsInvoiceOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Invoice Header */}

            <div className="border-b-2 border-gray-900 pb-4 mb-6 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  CoopConnect
                </h3>

                <p className="text-xs text-gray-600 font-medium">
                  Digital Cooperative Invoice
                </p>

                <span className="text-[11px] text-gray-400 mt-1 block">
                  {invoiceData.coop_name}
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-gray-900">
                  {invoiceData.invoice_number}
                </span>

                <p className="text-[11px] text-gray-500">
                  {invoiceData.issued_date}
                </p>
              </div>
            </div>

            {/* Bill Details */}

            <div className="grid grid-cols-2 gap-4 text-xs mb-6 pb-6 border-b border-gray-100">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">
                  Billed To
                </span>

                <p className="font-bold text-gray-900 text-sm">
                  {invoiceData.customer_name}
                </p>

                <span className="text-gray-500">
                  Booking #{invoiceData.booking_number}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">
                  Service Provider
                </span>

                <p className="font-bold text-gray-900 text-sm">
                  {invoiceData.worker_name}
                </p>

                <span className="text-emerald-700 font-medium">
                  Verified Cooperative Member
                </span>
              </div>
            </div>

            {/* Breakdown */}

            <div className="space-y-2 text-xs mb-6">
              <div className="flex justify-between py-1.5 border-b border-gray-100 font-semibold text-gray-700">
                <span>Description</span>
                <span>Amount</span>
              </div>

              <div className="flex justify-between py-1 text-gray-800">
                <span>
                  Service Charge ({invoiceData.service_type})
                </span>

                <span>
                  ₹{invoiceData.breakdown.service_amount}
                </span>
              </div>

              <div className="flex justify-between py-1 text-gray-500">
                <span>- Worker Payout</span>
                <span>
                  ₹{invoiceData.breakdown.worker_payout}
                </span>
              </div>

              <div className="flex justify-between py-1 text-gray-500">
                <span>- Welfare Fund Contribution</span>
                <span>
                  ₹{invoiceData.breakdown.welfare_contribution}
                </span>
              </div>

              <div className="flex justify-between py-1 text-gray-500">
                <span>- Cooperative Service Fee</span>
                <span>
                  ₹{invoiceData.breakdown.coop_fee}
                </span>
              </div>

              <div className="flex justify-between pt-3 border-t-2 border-gray-900 font-bold text-base text-gray-900">
                <span>Total Paid:</span>

                <span>₹{invoiceData.total_amount}</span>
              </div>
            </div>

            {/* Transaction */}

            <div className="p-3 bg-gray-50 rounded-xl text-[10px] text-gray-500 text-center mb-6">
              Transaction Ref:{" "}
              {invoiceData.breakdown.transaction_id} â€¢ Method:{" "}
              {invoiceData.breakdown.payment_method}
            </div>

            {/* Invoice Buttons */}

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

      {/* ================================================================== */}
      {/* RATING MODAL */}
      {/* ================================================================== */}

      {ratingBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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

            <h3 className="text-lg font-bold text-gray-900">
              Rate Your Service
            </h3>

            <p className="text-xs text-gray-500 mt-1">
              How was the workmanship of{" "}
              <strong>
                {ratingBooking.worker?.name || "the worker"}
              </strong>
              ?
            </p>

            {/* Stars */}

            <div className="flex items-center justify-center gap-2 my-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedStars(star)}
                  className="p-1 text-2xl focus:outline-none"
                  aria-label={`Rate ${star} star${
                    star > 1 ? "s" : ""
                  }`}
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

            {/* Feedback */}

            <textarea
              rows={2}
              value={ratingFeedback}
              onChange={(e) =>
                setRatingFeedback(e.target.value)
              }
              placeholder="Leave optional praise or feedback for the cooperative board..."
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500 mb-4 outline-none"
            />

            {/* Submit */}

            <button
              type="button"
              onClick={handleSubmitRating}
              disabled={isSubmittingRating}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-sm transition"
            >
              {isSubmittingRating
                ? "Submitting..."
                : "Submit Rating"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}