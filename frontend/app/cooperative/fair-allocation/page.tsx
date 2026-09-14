"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Scale, ShieldCheck, AlertCircle, Info, ArrowRight, UserCheck } from "lucide-react";
import { api } from "@/lib/api";

export default function FairAllocationPage() {
  const [allocationData, setAllocationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.cooperative.getFairAllocation()
      .then(setAllocationData)
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Fairness-Aware AI Engine
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Worker Fairness & Opportunity Allocation
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Transparent monitoring of job distribution equity, active workloads, and Opportunity Gap indicators
        </p>
      </div>

      {/* Fairness Math Model Box */}
      <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-base text-gray-900">Fairness-Aware Allocation Formula</h2>
        </div>
        <div className="p-3 bg-blue-50/60 rounded-xl font-mono text-xs text-blue-900 leading-relaxed border border-blue-100">
          Suitable Worker Score = (0.25 × Skill Suitability) + (0.15 × Service Success) + (0.15 × Availability) + (0.15 × Distance Proximity) + (0.10 × Rating) + (0.20 × Opportunity Factor)
        </div>
        <div className="text-xs text-gray-600 space-y-1 leading-relaxed">
          <p>
            <strong>Why This Matters:</strong> Commercial gig algorithms repeatedly favor the top 5% of rated workers, leaving equally skilled members without income. CoopConnect explicitly measures the <strong>Opportunity Gap</strong>. Qualified, verified workers with lower recent allocations receive a systematic algorithmic boost.
          </p>
          <p className="text-gray-500 italic">
            *Rule: Fairness operates exclusively among verified, qualified candidates; trade suitability and safety are never compromised.
          </p>
        </div>
      </div>

      {/* Metrics Table */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Member Fairness Inspection</h3>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading fairness metrics...</div>
        ) : allocationData?.empty || allocationData?.metrics?.length === 0 ? (
          /* Empty state */
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-2xs">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Scale className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">No workers registered yet</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-2 mb-6">
              When cooperative members register and undergo verification, their opportunity scores and allocation metrics will appear here.
            </p>
            <Link
              href="/signup/worker"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition inline-flex items-center gap-2"
            >
              <span>Register a Worker</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Worker Name</th>
                    <th className="px-5 py-3">Trade Skills</th>
                    <th className="px-5 py-3 text-center">Jobs Received</th>
                    <th className="px-5 py-3 text-center">Completed</th>
                    <th className="px-5 py-3 text-center">Active Workload</th>
                    <th className="px-5 py-3 text-center">Opportunity Score</th>
                    <th className="px-5 py-3 text-center">Opportunity Gap</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {allocationData.metrics.map((w: any) => (
                    <tr key={w.worker_id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-4 font-bold text-gray-900">
                        {w.worker_name}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {w.skills?.map((s: string) => (
                            <span key={s} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-semibold text-gray-900">
                        {w.jobs_received}
                      </td>
                      <td className="px-5 py-4 text-center font-semibold text-emerald-700">
                        {w.completed_jobs}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          w.current_workload > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                        }`}>
                          {w.current_workload} active
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-mono font-bold text-gray-900">
                        {w.opportunity_score}/100
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            w.opportunity_gap === "High Opportunity Need"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : w.opportunity_gap === "Heavily Utilized"
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {w.opportunity_gap}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          w.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                        }`}>
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
