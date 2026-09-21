"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Wrench, Phone, Mail, Award, CheckCircle2, ShieldCheck, 
  LogOut, FileText, Trophy, Star, ArrowRight, MessageSquare
} from "lucide-react";
import { api, clearAuthData } from "@/lib/api";

export default function WorkerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [isLoadingPerf, setIsLoadingPerf] = useState(false);

  useEffect(() => {
    api.worker.getProfile()
      .then((p) => {
        setProfile(p);
        if (p?.id) {
          setIsLoadingPerf(true);
          api.feedback.getWorkerPerformance(p.id)
            .then(setPerformance)
            .catch(() => {})
            .finally(() => setIsLoadingPerf(false));
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearAuthData();
    router.push("/login");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Worker Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review your performance standing, customer feedback, cooperative membership, and skill assessments
        </p>
      </div>

      {/* WORKER PERFORMANCE & LEADERBOARD STANDING */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white rounded-2xl p-6 sm:p-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-2xl shadow-sm">
              <Trophy className="w-6 h-6 fill-amber-950 text-amber-950" />
            </div>
            <div>
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">
                Leaderboard & Quality Index
              </span>
              <h2 className="text-xl font-bold text-white">Performance Standing</h2>
            </div>
          </div>

          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition self-start sm:self-auto border border-white/10"
          >
            <span>View Full Leaderboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/10">
            <span className="text-[11px] text-blue-200 font-medium uppercase tracking-wider block">Performance Score</span>
            <span className="text-3xl font-black text-white mt-1 block">
              {performance?.performance_score ?? "..."}
              <span className="text-xs text-blue-200 font-normal"> / 100</span>
            </span>
            <span className="text-[10px] text-blue-300 block mt-0.5">Bayesian Quality Weighted</span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/10">
            <span className="text-[11px] text-blue-200 font-medium uppercase tracking-wider block">Leaderboard Rank</span>
            <span className="text-3xl font-black text-amber-300 mt-1 block">
              {performance?.rank ? `#${performance.rank}` : "—"}
            </span>
            <span className="text-[10px] text-blue-300 block mt-0.5">
              {performance?.total_workers_ranked ? `out of ${performance.total_workers_ranked} craftspeople` : "All trades"}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/10">
            <span className="text-[11px] text-blue-200 font-medium uppercase tracking-wider block">Customer Rating</span>
            <span className="text-3xl font-black text-white mt-1 flex items-center gap-1">
              <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
              {performance?.average_rating ?? (profile?.rating || 5.0)}
            </span>
            <span className="text-[10px] text-blue-300 block mt-0.5">
              {performance?.total_reviews ?? 0} verified reviews
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/10">
            <span className="text-[11px] text-blue-200 font-medium uppercase tracking-wider block">Completed Services</span>
            <span className="text-3xl font-black text-white mt-1 block">
              {performance?.completed_jobs ?? (profile?.completed_jobs || 0)}
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-medium">
              {Math.round((performance?.completion_rate ?? 1.0) * 100)}% completion rate
            </span>
          </div>
        </div>
      </div>

      {/* RECENT CUSTOMER FEEDBACK */}
      {performance?.recent_reviews && performance.recent_reviews.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-2xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-gray-900 text-base">Customer Feedback & Reviews</h3>
            </div>
            <span className="text-xs text-gray-400 font-medium">
              Showing {performance.recent_reviews.length} most recent
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {performance.recent_reviews.map((rev: any) => (
              <div key={rev.id} className="p-4 bg-slate-50 border border-gray-200 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{rev.customer_name || "Customer"}</span>
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${
                          s <= rev.stars ? "fill-amber-400 text-amber-400" : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {rev.feedback ? (
                  <p className="text-gray-600 italic text-[11px]">&ldquo;{rev.feedback}&rdquo;</p>
                ) : (
                  <p className="text-gray-400 italic text-[10px]">Rated without written comments.</p>
                )}
                <span className="text-[10px] text-gray-400 block pt-1 border-t border-gray-200/60">
                  {new Date(rev.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN DOSSIER & PROFILE */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        {/* Worker Dossier Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 font-bold text-2xl flex items-center justify-center">
              {profile?.full_name ? profile.full_name.charAt(0) : "W"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{profile?.full_name}</h2>
              <span className="text-xs text-gray-500">Address: {profile?.address}</span>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            profile?.status === "VERIFIED"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {profile?.status}
          </span>
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Mobile Phone</span>
            <span className="font-semibold text-gray-900 block mt-1">+91 {profile?.mobile}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Email Address</span>
            <span className="font-semibold text-gray-900 block mt-1">{profile?.email}</span>
          </div>
        </div>

        {/* Verified Skills */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Registered Trade Skills</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile?.skills?.map((s: any) => (
              <div key={s.id} className="p-3 bg-slate-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-gray-900">{s.skill_name}</span>
                <span className="text-emerald-700 font-semibold">{s.years_experience} Years Exp</span>
              </div>
            ))}
          </div>
        </div>

        {/* Practical Assessment History */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Practical Skill Assessments</h3>
          <div className="space-y-2">
            {profile?.assessments?.map((a: any) => (
              <div key={a.id} className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-gray-900">{a.skill_name} Assessment</span>
                  <p className="text-gray-500 text-[11px]">{a.assessment_date}</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-emerald-800 text-sm block">{a.score}/100</span>
                  <span className="text-[10px] text-emerald-700 font-medium">PASSED</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 px-4 py-2 rounded-xl border border-red-200 hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
