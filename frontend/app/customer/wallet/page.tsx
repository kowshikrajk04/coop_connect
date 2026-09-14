"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CreditCard, ArrowRight, ShieldCheck, CheckCircle2, FileText } from "lucide-react";
import { api } from "@/lib/api";

export default function CustomerWalletPage() {
  const [completedBookings, setCompletedBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.customer.getBookings()
      .then((res) => {
        const paid = (res.previous || []).filter((b: any) => b.has_paid);
        setCompletedBookings(paid);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const totalSpent = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Wallet & Payments</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review digital invoices and track your cooperative contributions
        </p>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Services Paid</span>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">₹{totalSpent.toFixed(2)}</p>
          <span className="text-xs text-gray-500 mt-2 block">Across {completedBookings.length} completed bookings</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Cooperative Welfare Generated</span>
          <p className="text-3xl font-extrabold text-blue-600 mt-1">₹{(totalSpent * 0.05).toFixed(2)}</p>
          <span className="text-xs text-gray-500 mt-2 block">Directly credited to worker welfare & health reserve</span>
        </div>
      </div>

      {/* Transactions List */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Receipts</h2>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading receipts...</div>
        ) : completedBookings.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No payments yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1 mb-6">
              When you pay for completed services via UPI, your official cooperative invoices will appear here.
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
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-2xs">
            {completedBookings.map((b) => (
              <div key={b.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-semibold text-gray-900 text-sm block">#{b.booking_number} – {b.service_type}</span>
                  <span className="text-gray-500">{b.scheduled_date} • Worker: {b.worker?.name || "Assigned"}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-gray-900 text-sm block">₹{b.total_amount}</span>
                  <span className="text-emerald-700 font-medium">Paid via UPI</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
