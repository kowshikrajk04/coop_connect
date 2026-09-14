"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { HeartHandshake, ShieldCheck, TrendingUp, AlertCircle, ArrowRight, DollarSign } from "lucide-react";
import { api } from "@/lib/api";

export default function CooperativeWelfarePage() {
  const [welfareData, setWelfareData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.cooperative.getWelfare()
      .then(setWelfareData)
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Democratic Capital
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Cooperative Surplus & Welfare Fund
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Transparent, auditable distribution of collective welfare funds allocated from completed bookings
        </p>
      </div>

      {/* Top Pool Distribution Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Collected */}
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">Total Welfare Collected</span>
          <p className="text-2xl font-black text-emerald-800 mt-1">
            ₹{welfareData?.total_welfare_collected || 0}
          </p>
          <span className="text-[11px] text-emerald-600 mt-1 block">5% from every service</span>
        </div>

        {/* Card 2: Reserve Fund */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Reserve Fund (40%)</span>
          <p className="text-2xl font-black text-gray-900 mt-1">
            ₹{welfareData?.reserve_fund || 0}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">Emergency capital backing</span>
        </div>

        {/* Card 3: Training Support */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Training Support (25%)</span>
          <p className="text-2xl font-black text-blue-700 mt-1">
            ₹{welfareData?.training_fund || 0}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">Skill certifications</span>
        </div>

        {/* Card 4: Emergency Support */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Emergency Healthcare (20%)</span>
          <p className="text-2xl font-black text-rose-700 mt-1">
            ₹{welfareData?.emergency_fund || 0}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">Accident & illness relief</span>
        </div>

        {/* Card 5: Worker Pension */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Pension Pool (15%)</span>
          <p className="text-2xl font-black text-indigo-700 mt-1">
            ₹{welfareData?.pension_fund || 0}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">Retirement security</span>
        </div>
      </div>

      {/* Transparent Transaction Ledger */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Auditable Welfare Ledger</h2>
          <span className="text-xs text-gray-500">Live Transaction Records</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading ledger records...</div>
        ) : welfareData?.transactions?.length === 0 ? (
          /* Empty state */
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-2xs">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <HeartHandshake className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">No welfare transactions yet</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-2 mb-6">
              When customers book and pay for services, the 5% cooperative welfare contributions will automatically credit to this ledger.
            </p>
            <Link
              href="/cooperative/settings"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition inline-flex items-center gap-2"
            >
              <span>Configure Welfare Settings</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs divide-y divide-gray-100">
            {welfareData.transactions.map((tx: any) => (
              <div key={tx.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-gray-900 text-sm block">{tx.description}</span>
                  <span className="text-gray-500">{tx.date} • Beneficiary: {tx.worker_name}</span>
                </div>
                <div className="text-left sm:text-right flex-shrink-0">
                  <span className="font-black text-emerald-700 text-sm block">
                    +{tx.type === "CREDIT" ? "₹" : "-₹"}{tx.amount}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                    {tx.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
