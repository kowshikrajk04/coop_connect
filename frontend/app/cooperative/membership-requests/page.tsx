"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, CheckCircle2, XCircle, AlertTriangle, Clock,
  FileText, Star, Phone, Mail, MapPin, Eye, X, ArrowLeft,
  ShieldCheck, Award, Filter
} from "lucide-react";
import { api, getUserRole } from "@/lib/api";

export default function CooperativeMembershipRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Reject Modal State
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Dossier Modal State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await api.memberships.getCooperativeRequests(statusFilter);
      setRequests(data || []);
    } catch (err: any) {
      if (getUserRole() !== "COOPERATIVE") {
        router.push("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: number, workerName: string) => {
    if (!confirm(`Accept ${workerName} into your cooperative society? They will immediately become an ACTIVE member eligible for customer job allocations.`)) {
      return;
    }
    try {
      await api.memberships.approve(requestId);
      alert(`Worker ${workerName} accepted successfully! Membership is now ACTIVE.`);
      loadRequests();
    } catch (err: any) {
      alert(err.message || "Failed to approve membership request.");
    }
  };

  const handleExecuteReject = async () => {
    if (!rejectingRequestId) return;
    setIsProcessingAction(true);
    try {
      await api.memberships.reject(rejectingRequestId, rejectionReason);
      alert("Membership request rejected. The worker has been notified.");
      setRejectingRequestId(null);
      setRejectionReason("");
      loadRequests();
    } catch (err: any) {
      alert(err.message || "Failed to reject membership request.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/cooperative/dashboard"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Governance Dashboard
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Cooperative Membership Requests
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Review join applications and verify existing membership claims before admitting workers to the collective pool.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-xl border border-gray-200 text-xs font-semibold">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === s
                  ? "bg-white text-indigo-700 shadow-2xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {s === "ALL" ? "All Requests" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Request Cards / Table */}
      {isLoading ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl shadow-xs">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
          <p className="text-xs text-gray-500">Loading membership requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl p-8 shadow-xs">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">No Membership Requests Found</h3>
          <p className="text-xs text-gray-500 mt-1">
            {statusFilter === "PENDING"
              ? "All pending membership requests have been reviewed!"
              : "No membership request records match the selected filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className={`bg-white border-2 rounded-2xl p-6 shadow-2xs transition ${
                req.status === "PENDING"
                  ? "border-purple-200 hover:border-purple-300"
                  : req.status === "APPROVED"
                  ? "border-emerald-200 bg-emerald-50/20"
                  : "border-gray-200 bg-gray-50/50"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                {/* Worker Summary */}
                <div className="flex items-start gap-4">
                  {req.worker_photo ? (
                    <img
                      src={req.worker_photo}
                      alt={req.worker_name}
                      className="w-14 h-14 rounded-2xl object-cover border border-gray-200 shadow-2xs flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 font-bold text-xl flex items-center justify-center border border-indigo-100 flex-shrink-0">
                      {req.worker_name?.[0] || "W"}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{req.worker_name}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          req.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : req.status === "PENDING"
                            ? "bg-purple-50 text-purple-700 border-purple-300"
                            : "bg-red-50 text-red-700 border-red-300"
                        }`}
                      >
                        {req.status === "APPROVED" && "✓ APPROVED MEMBER"}
                        {req.status === "PENDING" && "⌛ PENDING REVIEW"}
                        {req.status === "REJECTED" && "✗ REJECTED"}
                      </span>
                      <span className="text-[10px] font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                        {req.membership_type === "EXISTING_MEMBER"
                          ? "Existing Member Claim"
                          : "New Membership Join"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {req.worker_mobile || "No phone"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {req.worker_email}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {req.worker_address || "Delhi NCR"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-semibold text-gray-700">Skills:</span>
                      {req.worker_skills && req.worker_skills.length > 0 ? (
                        req.worker_skills.map((skill: string) => (
                          <span
                            key={skill}
                            className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-md border border-indigo-100"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">No skills specified</span>
                      )}
                      <span className="text-xs text-gray-400">• {req.years_experience} yr(s) exp</span>
                    </div>

                    {req.notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-2.5 mt-2 max-w-xl">
                        <strong className="text-gray-700 block text-[11px]">Worker Note:</strong>
                        {req.notes}
                      </p>
                    )}

                    {req.rejection_reason && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5 mt-2 max-w-xl">
                        <strong className="text-red-800 block text-[11px]">Rejection Reason:</strong>
                        {req.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions & Dossier Button */}
                <div className="flex flex-wrap lg:flex-col items-end gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                  <div className="text-right text-[11px] text-gray-400 hidden lg:block">
                    Submitted: {new Date(req.requested_at).toLocaleDateString()}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl border border-gray-300 transition flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Dossier</span>
                    </button>

                    {req.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => {
                            setRejectingRequestId(req.id);
                            setRejectionReason("");
                          }}
                          className="px-3.5 py-2 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold rounded-xl border border-red-200 hover:border-red-300 transition"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(req.id, req.worker_name)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accept Member</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {rejectingRequestId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <button
              onClick={() => setRejectingRequestId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Reject Membership Request</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Provide an optional reason so the worker understands why this application was declined.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Rejection
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Incomplete proof of trade certification, or trade not supported in this region."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRejectingRequestId(null)}
                  className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReject}
                  disabled={isProcessingAction}
                  className="w-2/3 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-xs transition"
                >
                  {isProcessingAction ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WORKER DOSSIER MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedRequest(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
              {selectedRequest.worker_photo ? (
                <img
                  src={selectedRequest.worker_photo}
                  alt={selectedRequest.worker_name}
                  className="w-16 h-16 rounded-2xl object-cover border border-gray-200 shadow-2xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-700 font-bold text-2xl flex items-center justify-center border border-indigo-100">
                  {selectedRequest.worker_name?.[0] || "W"}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedRequest.worker_name}</h3>
                <p className="text-xs text-gray-500">
                  Worker ID #{selectedRequest.worker_id} • Verification Status: {selectedRequest.worker_status}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-500 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span>{selectedRequest.worker_rating || 5.0} Rating</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-2">
                  Contact Information
                </h4>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Mobile</span>
                    <span className="font-semibold text-gray-800">{selectedRequest.worker_mobile || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Email</span>
                    <span className="font-semibold text-gray-800">{selectedRequest.worker_email}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 block text-[10px]">Service Area / Address</span>
                    <span className="font-semibold text-gray-800">{selectedRequest.worker_address}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-2">
                  Trade Skills & Assessments
                </h4>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedRequest.worker_skills?.map((s: string) => (
                      <span key={s} className="bg-white px-2.5 py-1 rounded-md border border-gray-300 font-semibold text-gray-800">
                        {s} ({selectedRequest.years_experience} yrs)
                      </span>
                    ))}
                  </div>

                  {selectedRequest.assessments && selectedRequest.assessments.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 mt-2 space-y-1">
                      <span className="font-semibold text-gray-600 block text-[11px]">Skill Assessment Results:</span>
                      {selectedRequest.assessments.map((a: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-gray-700">
                          <span>{a.skill}</span>
                          <span className={`font-bold ${a.passed ? "text-emerald-600" : "text-amber-600"}`}>
                            {a.score}% ({a.passed ? "Passed" : "Under Evaluation"})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-2">
                  Uploaded Identity & Trade Proofs
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-800">Government Identity Proof</span>
                    </div>
                    {selectedRequest.id_document_url ? (
                      <a
                        href={selectedRequest.id_document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        View File →
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Simulated / Verified</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-800">Trade Skill Certificate</span>
                    </div>
                    {selectedRequest.cert_document_url ? (
                      <a
                        href={selectedRequest.cert_document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        View File →
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Simulated / Verified</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
