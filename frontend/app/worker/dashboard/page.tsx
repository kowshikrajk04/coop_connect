"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Wrench, CheckCircle2, AlertTriangle, Clock, MapPin, 
  Phone, Compass, Star, DollarSign, HeartHandshake, 
  Camera, ArrowRight, ShieldCheck, Power, X
} from "lucide-react";
import { api, getUserRole } from "@/lib/api";

export default function WorkerDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [jobsData, setJobsData] = useState<any>({ new_requests: [], active_jobs: [], completed_jobs: [] });
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Completion modal state
  const [completingJobId, setCompletingJobId] = useState<number | null>(null);
  const [completionPhotoUrl, setCompletionPhotoUrl] = useState("https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80");
  const [completionNotes, setCompletionNotes] = useState("");
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  useEffect(() => {
    loadWorkerData();
  }, []);

  const loadWorkerData = async () => {
    setIsLoading(true);
    try {
      const p = await api.worker.getProfile();
      setProfile(p);
      setIsAvailable(p.is_available);

      const j = await api.worker.getJobs();
      setJobsData(j);
    } catch (err: any) {
      if (getUserRole() !== "WORKER") {
        router.push("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAvailability = async () => {
    try {
      const res = await api.worker.toggleAvailability();
      setIsAvailable(res.is_available);
    } catch (e: any) {
      alert(e.message || "Failed to update availability");
    }
  };

  const handleAcceptJob = async (bookingId: number) => {
    try {
      await api.worker.acceptJob(bookingId);
      alert("Job accepted! Head over to Route & Map to view directions.");
      loadWorkerData();
    } catch (e: any) {
      alert(e.message || "Failed to accept job");
    }
  };

  const handleRejectJob = async (bookingId: number) => {
    try {
      await api.worker.rejectJob(bookingId);
      loadWorkerData();
    } catch (e: any) {
      alert(e.message || "Failed to reject");
    }
  };

  const handleStartJob = async (bookingId: number) => {
    try {
      await api.worker.startJob(bookingId);
      alert("Service marked as In Progress. Customer notified.");
      loadWorkerData();
    } catch (e: any) {
      alert(e.message || "Failed to start service");
    }
  };

  const handleCompleteJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingJobId) return;
    setIsSubmittingCompletion(true);
    try {
      const res = await api.worker.completeJob(completingJobId, {
        completion_photo_url: completionPhotoUrl,
        completion_notes: completionNotes,
      });
      alert(`Service completed! Worker Payout: ₹${res.payout} • Welfare Fund: ₹${res.welfare}`);
      setCompletingJobId(null);
      loadWorkerData();
    } catch (e: any) {
      alert(e.message || "Failed to complete service");
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Availability Toggle */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Cooperative Member Portal
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                profile?.status === "VERIFIED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : profile?.status === "REJECTED"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {profile?.status === "VERIFIED" && "✓ VERIFIED WORKER"}
              {profile?.status === "PENDING_VERIFICATION" && "⌛ PENDING VERIFICATION"}
              {profile?.status === "REJECTED" && "✗ REJECTED"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {profile?.full_name || "Cooperative Worker"}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Skills: {profile?.skills?.map((s: any) => s.skill_name).join(", ") || "Tradesperson"}
          </p>
        </div>

        {/* Availability Switch */}
        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200">
          <div className="text-right">
            <span className="text-xs font-bold text-gray-900 block">
              {isAvailable ? "Available for Jobs" : "Currently Offline"}
            </span>
            <span className="text-[10px] text-gray-400">
              {isAvailable ? "Ready to receive AI allocations" : "No new job offers sent"}
            </span>
          </div>
          <button
            onClick={handleToggleAvailability}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
              isAvailable ? "bg-emerald-600 justify-end" : "bg-gray-300 justify-start"
            }`}
          >
            <div className="bg-white w-4 h-4 rounded-full shadow-md transform"></div>
          </button>
        </div>
      </div>

      {/* Verification Notice if Pending */}
      {profile?.status === "PENDING_VERIFICATION" && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm font-semibold mb-0.5">Verification Review in Progress</strong>
            Your trade skill assessment and identity details have been submitted. The Cooperative Board is reviewing your profile. Once verified, new customer service bookings will be automatically allocated to you via our fairness engine.
          </div>
        </div>
      )}

      {/* Stat Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Completed Jobs</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{profile?.completed_jobs || 0}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Total service calls</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Customer Rating</span>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            <span className="text-2xl font-black text-gray-900">{profile?.rating || 5.0}</span>
          </div>
          <span className="text-[11px] text-emerald-700 mt-1 block">Cooperative Quality Member</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total Earnings</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">₹{profile?.total_earnings || 0}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Net payout via UPI</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">My Welfare Balance</span>
          <p className="text-2xl font-black text-blue-700 mt-1">₹{profile?.total_welfare || 0}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Health & pension reserve</span>
        </div>
      </div>

      {/* NEW JOB REQUESTS (OFFERED) */}
      {jobsData.new_requests && jobsData.new_requests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-lg font-bold text-gray-900">New Job Allocations ({jobsData.new_requests.length})</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobsData.new_requests.map((job: any) => (
              <div key={job.booking_id} className="bg-white border-2 border-emerald-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-gray-400">#{job.booking_number}</span>
                    <h3 className="text-lg font-bold text-gray-900">{job.service_type}</h3>
                    {job.is_emergency && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 mt-1">
                        <AlertTriangle className="w-3 h-3" />
                        EMERGENCY PRIORITY
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-500 block">Est. Payout</span>
                    <span className="text-lg font-bold text-emerald-700">₹{job.total_amount * 0.9}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-600">{job.description}</p>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>{job.customer_address} (~{job.distance_km} km away)</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>{job.scheduled_date} • {job.scheduled_time}</span>
                  </div>
                  <div className="text-[11px] text-blue-700 pt-1 border-t border-gray-200/60 font-medium">
                    Fairness Score: <strong>{job.suitability_score}/100</strong> • Matched based on opportunity balance
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleRejectJob(job.booking_id)}
                    className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleAcceptJob(job.booking_id)}
                    className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition"
                  >
                    Accept Job
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACCEPTED & ACTIVE JOBS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Active Assigned Jobs ({jobsData.active_jobs?.length || 0})
          </h2>
          <Link
            href="/worker/route"
            className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Open Route & Schedule Optimization</span>
          </Link>
        </div>

        {jobsData.active_jobs?.length === 0 ? (
          /* Empty state */
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Wrench className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No active jobs right now</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              Keep your status toggle set to <strong>Available</strong> to receive upcoming jobs matching your verified skills.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobsData.active_jobs.map((job: any) => (
              <div key={job.booking_id} className="bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-gray-400">#{job.booking_number}</span>
                    <h3 className="text-lg font-bold text-gray-900">{job.service_type}</h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {job.status}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                  <p className="font-semibold text-gray-900">Customer: {job.customer_name}</p>
                  <p className="text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>+91 {job.customer_mobile || "Customer Phone"}</span>
                  </p>
                  <p className="text-gray-600 flex items-center gap-1 pt-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span>{job.customer_address}</span>
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  {job.status === "ACCEPTED" && (
                    <button
                      onClick={() => handleStartJob(job.booking_id)}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                    >
                      Start Service
                    </button>
                  )}

                  {job.status === "IN_PROGRESS" && (
                    <button
                      onClick={() => {
                        setCompletingJobId(job.booking_id);
                        setCompletionNotes("");
                      }}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Upload Proof & Mark Completed</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SERVICE COMPLETION PROOF MODAL */}
      {completingJobId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={() => setCompletingJobId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Service Completion Proof</h3>
              <p className="text-xs text-gray-500">Provide photo proof and notes for customer & cooperative approval</p>
            </div>

            <form onSubmit={handleCompleteJob} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Completion Photo URL / Image Link
                </label>
                <input
                  type="text"
                  required
                  value={completionPhotoUrl}
                  onChange={(e) => setCompletionPhotoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Takes a simulated photo of repaired switchboard, faucet, or cleaned area.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Work Notes / Resolution Summary
                </label>
                <textarea
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Cleaned tap aerator mesh and replaced teflon tape seal. Zero leakage tested."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCompletingJobId(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCompletion}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                >
                  {isSubmittingCompletion ? "Submitting..." : "Submit Completion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
