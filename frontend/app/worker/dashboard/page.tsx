"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Wrench, CheckCircle2, AlertTriangle, Clock, MapPin, 
  Phone, Compass, Star, DollarSign, HeartHandshake, 
  Camera, ArrowRight, ShieldCheck, Power, X, Building2
} from "lucide-react";
import { api, getUserRole } from "@/lib/api";

export default function WorkerDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [membershipStatus, setMembershipStatus] = useState<any>(null);
  const [jobsData, setJobsData] = useState<any>({ new_requests: [], active_jobs: [], completed_jobs: [] });
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Cooperative membership modal state
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"EXISTING" | "NEW">("NEW");
  const [cooperativesList, setCooperativesList] = useState<any[]>([]);
  const [selectedCoopId, setSelectedCoopId] = useState<number | null>(null);
  const [membershipNotes, setMembershipNotes] = useState("");
  const [isSubmittingMembership, setIsSubmittingMembership] = useState(false);
  const [membershipError, setMembershipError] = useState("");

  // Completion modal state
  const [completingJobId, setCompletingJobId] = useState<number | null>(null);
  const [completionPhotoUrl, setCompletionPhotoUrl] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  useEffect(() => {
    loadWorkerData();
  }, []);

  const loadWorkerData = async () => {
    setIsLoading(true);
    try {
      const [p, j, m] = await Promise.all([
        api.worker.getProfile(),
        api.worker.getJobs(),
        api.memberships.getMyStatus().catch(() => null)
      ]);
      setProfile(p);
      setIsAvailable(p.is_available);
      setJobsData(j);
      setMembershipStatus(m);
    } catch (err: any) {
      if (getUserRole() !== "WORKER") {
        router.push("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openMembershipModal = async (mode: "EXISTING" | "NEW") => {
    setModalMode(mode);
    setMembershipError("");
    setMembershipNotes("");
    setSelectedCoopId(null);
    setIsJoinModalOpen(true);
    try {
      const coops = await api.memberships.getCooperatives();
      setCooperativesList(coops || []);
      if (coops && coops.length > 0) {
        setSelectedCoopId(coops[0].id);
      }
    } catch (e: any) {
      setMembershipError("Failed to fetch available cooperatives list.");
    }
  };

  const handleSubmitMembershipRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoopId) {
      setMembershipError("Please select a cooperative.");
      return;
    }
    setIsSubmittingMembership(true);
    setMembershipError("");
    try {
      await api.memberships.requestJoin({
        cooperative_id: selectedCoopId,
        membership_type: modalMode === "EXISTING" ? "EXISTING_MEMBER" : "JOIN_REQUEST",
        notes: membershipNotes,
      });
      alert("Membership request submitted! The cooperative board has been notified for verification.");
      setIsJoinModalOpen(false);
      loadWorkerData();
    } catch (err: any) {
      setMembershipError(err.message || "Failed to submit membership request.");
    } finally {
      setIsSubmittingMembership(false);
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

      {/* COOPERATIVE MEMBERSHIP STATUS CARD */}
      {membershipStatus?.membership_status === "ACTIVE" ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Verified Cooperative Society
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ✓ ACTIVE MEMBER
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  {membershipStatus?.cooperative_name || profile?.cooperative_name || "Cooperative Society"}
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Registration: <span className="font-mono font-semibold">{membershipStatus?.cooperative_registration || "COOP-REG"}</span> • Fully eligible to receive customer job allocations via AI fairness engine.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : membershipStatus?.membership_status === "PENDING" ? (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    Cooperative Membership
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    ⌛ PENDING APPROVAL
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  Awaiting Review from {membershipStatus?.latest_request?.cooperative_name || "Cooperative Society"}
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Your membership request is currently under review by the cooperative admin board. You will receive an in-app alert once your membership is verified.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : membershipStatus?.membership_status === "REJECTED" ? (
        <div className="bg-red-50/70 border border-red-200 rounded-2xl p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-800 uppercase tracking-wider">
                    Cooperative Membership
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                    ✗ NOT APPROVED
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  Application Not Approved by {membershipStatus?.latest_request?.cooperative_name || "Cooperative Society"}
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {membershipStatus?.latest_request?.rejection_reason
                    ? `Reason provided: "${membershipStatus.latest_request.rejection_reason}"`
                    : "Your membership application was not approved at this time."}{" "}
                  You are welcome to submit an application to another registered cooperative.
                </p>
              </div>
            </div>
            <button
              onClick={() => openMembershipModal("NEW")}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-2xs whitespace-nowrap"
            >
              Apply to Another Cooperative
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-indigo-100 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                    Cooperative Association Required
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    NOT JOINED
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  Connect With an Accredited Labor Cooperative
                </h3>
                <p className="text-xs text-gray-600 mt-0.5 max-w-2xl">
                  CoopConnect guarantees democratic governance and welfare benefits. Workers must belong to an active cooperative society to receive AI-allocated service jobs.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
              <button
                onClick={() => openMembershipModal("EXISTING")}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl border border-gray-300 transition shadow-2xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-gray-600" />
                <span>I am already a member</span>
              </button>
              <button
                onClick={() => openMembershipModal("NEW")}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1.5"
              >
                <Building2 className="w-4 h-4" />
                <span>Find & Join a Cooperative</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                  Upload or link a photo of the completed repair or service proof.
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

      {/* COOPERATIVE MEMBERSHIP REQUEST / VERIFICATION MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsJoinModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {modalMode === "EXISTING" ? "Verify Existing Cooperative Membership" : "Join a Registered Cooperative"}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {modalMode === "EXISTING"
                  ? "Select your current cooperative society and submit your verification request."
                  : "Choose an accredited cooperative society to join and access customer job allocations."}
              </p>
            </div>

            {membershipError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{membershipError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitMembershipRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Select Cooperative Society *
                </label>
                {cooperativesList.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl border border-gray-200">
                    Loading verified cooperatives...
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {cooperativesList.map((coop) => (
                      <label
                        key={coop.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                          selectedCoopId === coop.id
                            ? "border-indigo-600 bg-indigo-50/50 shadow-2xs"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="cooperative_id"
                          value={coop.id}
                          checked={selectedCoopId === coop.id}
                          onChange={() => setSelectedCoopId(coop.id)}
                          className="mt-1 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900 block truncate">
                              {coop.name}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">
                              {coop.registration_number}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                            {coop.address} • Contact: {coop.contact_person}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                            <span>Admin Fee: {coop.service_fee_pct}%</span>
                            <span>Welfare Reserve: {coop.welfare_pct}%</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {modalMode === "EXISTING"
                    ? "Membership Details / Existing ID Number (Optional)"
                    : "Notes / Introduction for Cooperative Board (Optional)"}
                </label>
                <textarea
                  rows={3}
                  value={membershipNotes}
                  onChange={(e) => setMembershipNotes(e.target.value)}
                  placeholder={
                    modalMode === "EXISTING"
                      ? "e.g. Member ID #DL-904, enrolled under Secretary Ramesh Kumar in 2023."
                      : "e.g. Certified electrician with 5 years experience in domestic wiring looking to join the cooperative pool."
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMembership || cooperativesList.length === 0}
                  className="w-2/3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition"
                >
                  {isSubmittingMembership ? "Submitting..." : "Submit Membership Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
