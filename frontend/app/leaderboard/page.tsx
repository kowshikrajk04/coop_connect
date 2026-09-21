"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Trophy, Medal, Star, Award, ShieldCheck, Filter, 
  Calendar, CheckCircle2, ChevronRight, User, ThumbsUp, 
  Briefcase, Building2, AlertCircle, X, ExternalLink
} from "lucide-react";
import { api } from "@/lib/api";

const TRADES = [
  "All Trades",
  "Electrician",
  "Plumber",
  "Carpenter",
  "Painter",
  "Domestic Helper",
  "Caregiver",
  "Driver",
  "Gardener",
  "Cleaner",
  "Technician"
];

const TIME_PERIODS = [
  { id: "all", label: "All Time" },
  { id: "this_month", label: "This Month" },
  { id: "3_months", label: "Last 3 Months" },
];

export default function LeaderboardPage() {
  const [selectedTrade, setSelectedTrade] = useState("All Trades");
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [selectedCoopId, setSelectedCoopId] = useState<number | "ALL">("ALL");
  const [cooperatives, setCooperatives] = useState<any[]>([]);

  const [leaderboardItems, setLeaderboardItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Worker detail modal
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [workerPerf, setWorkerPerf] = useState<any | null>(null);
  const [isLoadingPerf, setIsLoadingPerf] = useState(false);

  // Load cooperatives for filtering
  useEffect(() => {
    api.memberships.getCooperatives()
      .then((res: any) => {
        setCooperatives(res.cooperatives || []);
      })
      .catch(() => {});
  }, []);

  // Fetch leaderboard data whenever filters change
  useEffect(() => {
    fetchLeaderboard();
  }, [selectedTrade, selectedPeriod, selectedCoopId]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.leaderboard.get({
        trade: selectedTrade === "All Trades" ? undefined : selectedTrade,
        cooperative_id: selectedCoopId === "ALL" ? undefined : Number(selectedCoopId),
        time_period: selectedPeriod,
      });
      setLeaderboardItems(res.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load leaderboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDossier = async (workerId: number) => {
    setSelectedWorkerId(workerId);
    setIsLoadingPerf(true);
    try {
      const data = await api.feedback.getWorkerPerformance(workerId);
      setWorkerPerf(data);
    } catch (err: any) {
      alert("Failed to load worker performance: " + (err.message || "Error"));
      setSelectedWorkerId(null);
    } finally {
      setIsLoadingPerf(false);
    }
  };

  const topThree = leaderboardItems.slice(0, 3);
  const remainingWorkers = leaderboardItems.slice(3);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Hero Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold mb-3 border border-amber-200">
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span>Worker Performance & Quality Index</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                Cooperative Worker Leaderboard
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
                Recognizing outstanding craftsmanship, reliability, and community trust. 
                Scores are computed using Bayesian confidence weighting and completion consistency.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-gray-200">
              <div className="text-center px-3 border-r border-gray-200">
                <span className="block text-2xl font-black text-blue-600">{leaderboardItems.length}</span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ranked Workers</span>
              </div>
              <div className="text-center px-3 border-r border-gray-200">
                <span className="block text-2xl font-black text-emerald-600">
                  {leaderboardItems.length > 0
                    ? (leaderboardItems.reduce((acc, curr) => acc + curr.completed_jobs, 0))
                    : 0}
                </span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Jobs Finished</span>
              </div>
              <div className="text-center px-3">
                <span className="block text-2xl font-black text-amber-500">
                  {leaderboardItems.length > 0
                    ? (leaderboardItems.reduce((acc, curr) => acc + curr.total_reviews, 0))
                    : 0}
                </span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Verified Reviews</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Trade & Cooperative Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium shadow-xs">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">Trade:</span>
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="bg-transparent font-semibold text-gray-800 focus:outline-none cursor-pointer"
                >
                  {TRADES.map((trade) => (
                    <option key={trade} value={trade}>{trade}</option>
                  ))}
                </select>
              </div>

              {cooperatives.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium shadow-xs">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-500">Cooperative:</span>
                  <select
                    value={selectedCoopId}
                    onChange={(e) => setSelectedCoopId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                    className="bg-transparent font-semibold text-gray-800 focus:outline-none cursor-pointer max-w-[200px] truncate"
                  >
                    <option value="ALL">All Cooperatives</option>
                    {cooperatives.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Time Period Selector */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl self-start md:self-auto border border-gray-200 text-xs font-medium">
              {TIME_PERIODS.map((period) => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    selectedPeriod === period.id
                      ? "bg-white text-blue-700 font-bold shadow-xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm font-medium">Calculating verified scores and rankings...</p>
          </div>
        ) : leaderboardItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Workers Found</h3>
            <p className="text-sm text-gray-500 mt-1">
              No workers matched the selected filters. Try choosing &quot;All Trades&quot; or changing the time period.
            </p>
            <button
              onClick={() => {
                setSelectedTrade("All Trades");
                setSelectedCoopId("ALL");
                setSelectedPeriod("all");
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* TOP 3 PODIUM */}
            {topThree.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-bold text-gray-900">Top Performing Craftspeople</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {topThree.map((worker, index) => {
                    const rankConfig = [
                      {
                        medal: "🥇",
                        label: "Rank 1 • Top Performer",
                        bg: "bg-gradient-to-b from-amber-50 to-white",
                        border: "border-amber-300 ring-2 ring-amber-200/60",
                        scoreBg: "bg-amber-500 text-white",
                        badgeBg: "bg-amber-100 text-amber-800 border-amber-300"
                      },
                      {
                        medal: "🥈",
                        label: "Rank 2 • Runner Up",
                        bg: "bg-gradient-to-b from-slate-50 to-white",
                        border: "border-slate-300",
                        scoreBg: "bg-slate-600 text-white",
                        badgeBg: "bg-slate-100 text-slate-800 border-slate-300"
                      },
                      {
                        medal: "🥉",
                        label: "Rank 3 • Coop Champion",
                        bg: "bg-gradient-to-b from-amber-50/40 to-white",
                        border: "border-amber-700/30",
                        scoreBg: "bg-amber-800 text-white",
                        badgeBg: "bg-amber-100/70 text-amber-900 border-amber-300"
                      }
                    ][index] || {
                      medal: `#${index + 1}`,
                      label: `Rank ${index + 1}`,
                      bg: "bg-white",
                      border: "border-gray-200",
                      scoreBg: "bg-blue-600 text-white",
                      badgeBg: "bg-gray-100 text-gray-800 border-gray-200"
                    };

                    return (
                      <div
                        key={worker.worker_id}
                        className={`rounded-2xl p-6 border ${rankConfig.border} ${rankConfig.bg} shadow-sm relative flex flex-col justify-between hover:shadow-md transition`}
                      >
                        <div>
                          {/* Rank Ribbon */}
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-2xl">{rankConfig.medal}</span>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${rankConfig.badgeBg}`}>
                              {worker.badge || rankConfig.label}
                            </span>
                          </div>

                          {/* Avatar & Worker Info */}
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-xl flex-shrink-0">
                              {worker.full_name?.charAt(0) || "W"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 text-base truncate">
                                {worker.full_name}
                              </h3>
                              <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                                <Building2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span>{worker.cooperative_name || "Federation Member"}</span>
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {worker.skills?.slice(0, 2).map((s: string) => (
                                  <span key={s} className="px-2 py-0.5 bg-white border border-gray-200 text-gray-700 text-[10px] font-semibold rounded-md">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-3 gap-2 bg-white rounded-xl p-3 border border-gray-100 my-4 text-center">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-400 block">Rating</span>
                              <span className="text-sm font-black text-gray-900 flex items-center justify-center gap-1 mt-0.5">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                                {worker.average_rating}
                              </span>
                              <span className="text-[10px] text-gray-400">({worker.total_reviews})</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-400 block">Completed</span>
                              <span className="text-sm font-black text-gray-900 mt-0.5 block">
                                {worker.completed_jobs}
                              </span>
                              <span className="text-[10px] text-gray-400">jobs</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-gray-400 block">Rate</span>
                              <span className="text-sm font-black text-emerald-600 mt-0.5 block">
                                {Math.round(worker.completion_rate * 100)}%
                              </span>
                              <span className="text-[10px] text-gray-400">success</span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Score & Action */}
                        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 block">PERFORMANCE SCORE</span>
                            <span className="text-xl font-black text-blue-900 leading-none">
                              {worker.performance_score}
                              <span className="text-xs text-gray-400 font-normal"> / 100</span>
                            </span>
                          </div>
                          <button
                            onClick={() => handleOpenDossier(worker.worker_id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1 transition"
                          >
                            <span>Dossier</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FULL LEADERBOARD TABLE */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">All Ranked Craftspeople</h3>
                  <p className="text-xs text-gray-500">
                    Showing {leaderboardItems.length} workers based on Bayesian quality and volume metrics
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4 text-center w-14">Rank</th>
                      <th className="py-3.5 px-4">Worker & Cooperative</th>
                      <th className="py-3.5 px-4">Trade Skills</th>
                      <th className="py-3.5 px-4 text-center">Avg Rating</th>
                      <th className="py-3.5 px-4 text-center">Completed Jobs</th>
                      <th className="py-3.5 px-4 text-center">Completion Rate</th>
                      <th className="py-3.5 px-4">Performance Score</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leaderboardItems.map((worker) => {
                      const medalDisplay =
                        worker.rank === 1 ? "🥇 1" :
                        worker.rank === 2 ? "🥈 2" :
                        worker.rank === 3 ? "🥉 3" :
                        `#${worker.rank}`;

                      return (
                        <tr key={worker.worker_id} className="hover:bg-slate-50/70 transition">
                          {/* Rank */}
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center justify-center font-bold ${
                              worker.rank <= 3 ? "text-base font-black text-amber-600" : "text-xs text-gray-700"
                            }`}>
                              {medalDisplay}
                            </span>
                          </td>

                          {/* Name & Cooperative */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                                {worker.full_name?.charAt(0) || "W"}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 block text-xs">
                                  {worker.full_name}
                                </span>
                                <span className="text-[11px] text-gray-500 block truncate max-w-[180px]">
                                  {worker.cooperative_name || "Federation Member"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Skills */}
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {worker.skills?.slice(0, 2).map((s: string) => (
                                <span key={s} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-medium rounded-md">
                                  {s}
                                </span>
                              ))}
                              {worker.skills?.length > 2 && (
                                <span className="text-[10px] text-gray-400 self-center">
                                  +{worker.skills.length - 2}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Rating */}
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-1 font-bold text-gray-900">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                              <span>{worker.average_rating}</span>
                            </div>
                            <span className="block text-[10px] text-gray-400">
                              {worker.total_reviews} reviews
                            </span>
                          </td>

                          {/* Completed Jobs */}
                          <td className="py-4 px-4 text-center">
                            <span className="font-bold text-gray-900 block">
                              {worker.completed_jobs}
                            </span>
                            <span className="text-[10px] text-gray-400">services</span>
                          </td>

                          {/* Completion Rate */}
                          <td className="py-4 px-4 text-center">
                            <span className="font-bold text-emerald-600 block">
                              {Math.round(worker.completion_rate * 100)}%
                            </span>
                            <span className="text-[10px] text-gray-400">reliability</span>
                          </td>

                          {/* Performance Score */}
                          <td className="py-4 px-4 min-w-[160px]">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-black text-blue-900">{worker.performance_score}</span>
                              {worker.badge && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  {worker.badge}
                                </span>
                              )}
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, worker.performance_score))}%` }}
                              />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleOpenDossier(worker.worker_id)}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-blue-700 font-medium text-xs transition"
                            >
                              Reviews & Dossier
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* WORKER PERFORMANCE & FEEDBACK DOSSIER MODAL */}
      {selectedWorkerId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setSelectedWorkerId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoadingPerf || !workerPerf ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-gray-500">Loading worker dossier...</p>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-xl flex-shrink-0">
                    {workerPerf.full_name?.charAt(0) || "W"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{workerPerf.full_name}</h3>
                      {workerPerf.rank && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                          Rank #{workerPerf.rank}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span>{workerPerf.cooperative_name || "Federation Cooperative"}</span>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {workerPerf.skills?.map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Cards */}
                <div className="grid grid-cols-4 gap-2 my-4 text-center">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Performance</span>
                    <span className="text-base font-black text-blue-900 mt-0.5 block">{workerPerf.performance_score}</span>
                    <span className="text-[10px] text-gray-400">out of 100</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Avg Rating</span>
                    <span className="text-base font-black text-amber-500 mt-0.5 flex items-center justify-center gap-0.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {workerPerf.average_rating}
                    </span>
                    <span className="text-[10px] text-gray-400">{workerPerf.total_reviews} reviews</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Completed</span>
                    <span className="text-base font-black text-gray-900 mt-0.5 block">{workerPerf.completed_jobs}</span>
                    <span className="text-[10px] text-gray-400">jobs</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Completion</span>
                    <span className="text-base font-black text-emerald-600 mt-0.5 block">
                      {Math.round(workerPerf.completion_rate * 100)}%
                    </span>
                    <span className="text-[10px] text-gray-400">success</span>
                  </div>
                </div>

                {/* Rating Distribution */}
                <div className="bg-slate-50/60 rounded-xl p-3 border border-gray-100 mb-4">
                  <h4 className="text-xs font-bold text-gray-700 mb-2">Customer Star Distribution</h4>
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = workerPerf.rating_distribution?.[String(stars)] || 0;
                    const pct = workerPerf.total_reviews > 0 ? (count / workerPerf.total_reviews) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-2 text-[11px] text-gray-600 mb-1">
                        <span className="w-6 flex items-center gap-0.5 font-bold">
                          {stars}<Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right text-gray-400 text-[10px]">{count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Recent Customer Reviews */}
                <div>
                  <h4 className="text-xs font-bold text-gray-900 mb-2.5">
                    Recent Customer Feedback ({workerPerf.recent_reviews?.length || 0})
                  </h4>

                  {workerPerf.recent_reviews?.length === 0 ? (
                    <p className="text-xs text-gray-400 py-3 text-center italic">No customer reviews yet.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {workerPerf.recent_reviews?.map((review: any) => (
                        <div key={review.id} className="p-3 bg-white border border-gray-200 rounded-xl text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-900">{review.customer_name || "Customer"}</span>
                            <div className="flex items-center gap-0.5 text-amber-500">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3 h-3 ${
                                    s <= review.stars ? "fill-amber-400 text-amber-400" : "text-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {review.feedback ? (
                            <p className="text-gray-600 italic text-[11px]">&ldquo;{review.feedback}&rdquo;</p>
                          ) : (
                            <p className="text-gray-400 text-[10px] italic">No written comment provided.</p>
                          )}
                          <span className="text-[10px] text-gray-400 block mt-1">
                            {new Date(review.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => setSelectedWorkerId(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition"
                  >
                    Close Dossier
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
