"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DollarSign, HeartHandshake, Star, ShieldCheck, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

export default function WorkerEarningsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [jobsData, setJobsData] = useState<any>({ completed_jobs: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.worker.getProfile(), api.worker.getJobs()])
      .then(([p, j]) => {
        setProfile(p);
        setJobsData(j);
      })
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Earnings & Welfare</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track your direct net take-home earnings and transparent cooperative welfare funds
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Net Take-Home Earnings</span>
          <p className="text-3xl font-black text-emerald-700 mt-1">₹{profile?.total_earnings || 0}</p>
          <span className="text-xs text-gray-400 mt-2 block">Directly credited to worker bank/UPI</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Cooperative Welfare Balance</span>
          <p className="text-3xl font-black text-blue-700 mt-1">₹{profile?.total_welfare || 0}</p>
          <span className="text-xs text-gray-400 mt-2 block">Reserved for health & retirement</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Customer Rating</span>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            <span className="text-3xl font-black text-gray-900">{profile?.rating || 5.0}</span>
          </div>
          <span className="text-xs text-emerald-700 mt-2 block">Based on verified completed jobs</span>
        </div>
      </div>

      {/* Completed Jobs History */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Completed Payout History</h2>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading payout records...</div>
        ) : jobsData.completed_jobs?.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-2xs">
            <h3 className="text-base font-bold text-gray-900">No completed jobs yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              Once you complete your accepted service requests, your payments and welfare credits will be listed here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-2xs">
            {jobsData.completed_jobs.map((job: any) => (
              <div key={job.booking_id} className="p-4 sm:p-5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-gray-900 text-sm block">#{job.booking_number} – {job.service_type}</span>
                  <span className="text-gray-500">{job.scheduled_date} • Customer: {job.customer_name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-700 text-sm block">+₹{job.payout}</span>
                  <span className="text-gray-400 text-[10px]">Welfare Credit: +₹{roundVal(job.total_amount * 0.05)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function roundVal(n: number) {
  return Math.round(n * 100) / 100;
}
