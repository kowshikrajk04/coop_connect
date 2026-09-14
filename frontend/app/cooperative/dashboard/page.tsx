"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Building2, Users, CheckCircle2, UserCheck, Scale, 
  HeartHandshake, TrendingUp, Settings, ArrowRight, 
  DollarSign, Briefcase, AlertTriangle, ShieldCheck
} from "lucide-react";
import { api, getUserRole } from "@/lib/api";

export default function CooperativeDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const s = await api.cooperative.getDashboard();
      setStats(s);
    } catch (e) {
      if (getUserRole() !== "COOPERATIVE") {
        router.push("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1">
            Society Administration
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Cooperative Governance Dashboard
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Democratic oversight of worker verification, fair opportunity allocations, and collective welfare reserves.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/cooperative/verification"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition flex items-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            <span>Verify Workers ({stats?.pending_verifications || 0})</span>
          </Link>
        </div>
      </div>

      {/* 6 Core Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Workers</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats?.total_workers || 0}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Registered members</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Available Now</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{stats?.available_workers || 0}</p>
          <span className="text-[11px] text-emerald-700 mt-1 block">Verified & online</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Pending Review</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats?.pending_verifications || 0}</p>
          <span className="text-[11px] text-amber-700 mt-1 block">Awaiting board check</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Bookings</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{stats?.total_bookings || 0}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Requests processed</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Coop Revenue</span>
          <p className="text-2xl font-black text-indigo-700 mt-1">₹{stats?.cooperative_revenue || 0}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">5% service fee</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Welfare Fund</span>
          <p className="text-2xl font-black text-blue-700 mt-1">₹{stats?.welfare_fund || 0}</p>
          <span className="text-[11px] text-blue-700 mt-1 block">Health & reserve</span>
        </div>
      </div>

      {/* Primary Management Hub Cards */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Cooperative Operations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Worker Verification */}
          <Link
            href="/cooperative/verification"
            className="group bg-white border border-gray-200 hover:border-indigo-400 rounded-2xl p-6 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Verify Workers</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Inspect applicant dossiers, review practical skill test scores & voice transcripts, approve or reject.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
              <span>{stats?.pending_verifications || 0} Pending</span>
              <span>Review →</span>
            </div>
          </Link>

          {/* Card 2: Fair Work Allocation */}
          <Link
            href="/cooperative/fair-allocation"
            className="group bg-white border border-gray-200 hover:border-blue-400 rounded-2xl p-6 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Fair Allocation</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Inspect live Opportunity Gap metrics to prevent work concentration and ensure equitable job distribution.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-blue-600">
              <span>AI Opportunity Engine</span>
              <span>Inspect →</span>
            </div>
          </Link>

          {/* Card 3: Welfare Fund Ledger */}
          <Link
            href="/cooperative/welfare"
            className="group bg-white border border-gray-200 hover:border-emerald-400 rounded-2xl p-6 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Welfare Fund</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Track transparent allocation across Reserve Fund, Training Support, Emergency Healthcare, and Pensions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>₹{stats?.welfare_fund || 0} Accumulated</span>
              <span>View Ledger →</span>
            </div>
          </Link>

          {/* Card 4: Demand Forecasting */}
          <Link
            href="/cooperative/demand-forecast"
            className="group bg-white border border-gray-200 hover:border-purple-400 rounded-2xl p-6 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Demand Forecast</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Machine learning forecast predicting trade volume, location hotspots, and recruitment requirements.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-purple-700">
              <span>ML Predictive Model</span>
              <span>Analyze →</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
