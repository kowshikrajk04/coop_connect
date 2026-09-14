"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  UserCheck, CheckCircle2, XCircle, HelpCircle, 
  FileText, Star, Phone, MapPin, Eye, X, Award, AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";

export default function WorkerVerificationPage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Detail Modal
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [workerDetail, setWorkerDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Reject / Info / Re-assessment Modal
  const [actionType, setActionType] = useState<"REJECT" | "REQUEST_INFO" | "REQUEST_REASSESSMENT" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  useEffect(() => {
    loadWorkers();
  }, [statusFilter]);

  const loadWorkers = async () => {
    setIsLoading(true);
    try {
      const data = await api.cooperative.getWorkers(statusFilter);
      setWorkers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (workerId: number) => {
    setSelectedWorkerId(workerId);
    setIsLoadingDetail(true);
    try {
      const detail = await api.cooperative.getWorkerDetail(workerId);
      setWorkerDetail(detail);
    } catch (e) {
      alert("Failed to load worker dossier");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleApprove = async (workerId: number) => {
    if (!confirm("Approve this worker? They will immediately become eligible for customer AI allocations.")) {
      return;
    }
    try {
      await api.cooperative.verifyWorker(workerId, "APPROVE");
      alert("Worker verified successfully! Member is now active.");
      if (selectedWorkerId === workerId) {
        setSelectedWorkerId(null);
      }
      loadWorkers();
    } catch (e: any) {
      alert(e.message || "Failed to approve");
    }
  };

  const handleExecuteAction = async () => {
    if (!selectedWorkerId || !actionType) return;
    setIsProcessingAction(true);
    try {
      await api.cooperative.verifyWorker(selectedWorkerId, actionType, actionReason);
      alert(`Worker updated: ${actionType}`);
      setActionType(null);
      setActionReason("");
      setSelectedWorkerId(null);
      loadWorkers();
    } catch (e: any) {
      alert(e.message || "Failed to update worker");
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Worker Verification</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review member applications, practical scenario test results, and approve candidates for active service
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        {["ALL", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              statusFilter === tab
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {tab === "ALL" && "All Workers"}
            {tab === "PENDING_VERIFICATION" && "Pending Review"}
            {tab === "VERIFIED" && "Verified Members"}
            {tab === "REJECTED" && "Rejected"}
          </button>
        ))}
      </div>

      {/* Workers Table / Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading worker applications...</div>
      ) : workers.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">No workers registered yet</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2 mb-6">
            There are currently no worker profiles matching this filter. Once tradespeople sign up and submit their skill assessment, they will appear here for board verification.
          </p>
          <Link
            href="/signup/worker"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition inline-flex items-center gap-2"
          >
            <span>Register a Worker (Test Flow)</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs divide-y divide-gray-100">
          {workers.map((w) => (
            <div key={w.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-800 font-bold text-lg flex items-center justify-center flex-shrink-0">
                  {w.full_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-base">{w.full_name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        w.status === "VERIFIED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : w.status === "REJECTED"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>

                  <div className="text-gray-500 mt-1 flex flex-wrap items-center gap-3">
                    <span>📞 +91 {w.mobile}</span>
                    <span>📍 {w.address}</span>
                    <span>Applied: {w.created_at}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {w.skills?.map((s: string) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium text-[11px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleOpenDetail(w.id)}
                  className="px-3 py-1.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Dossier</span>
                </button>

                {w.status === "PENDING_VERIFICATION" && (
                  <>
                    <button
                      onClick={() => handleApprove(w.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedWorkerId(w.id);
                        setActionType("REJECT");
                        setActionReason("");
                      }}
                      className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAILED WORKER DOSSIER MODAL */}
      {selectedWorkerId && workerDetail && !actionType && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl relative my-8 border border-gray-200 space-y-6">
            <button
              onClick={() => setSelectedWorkerId(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xl flex items-center justify-center">
                {workerDetail.full_name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{workerDetail.full_name}</h3>
                <p className="text-xs text-gray-500">
                  Status: <strong>{workerDetail.status}</strong> • Opportunity Score: <strong>{workerDetail.opportunity_score}/100</strong>
                </p>
              </div>
            </div>

            {/* Practical Assessment Evidence */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  AI Voice Skill Assessment Dossier
                </h4>
                <span className="text-[11px] text-gray-500 font-medium">
                  Verified Scenario Rubrics
                </span>
              </div>

              {(!workerDetail.assessments || workerDetail.assessments.length === 0) ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 text-center">
                  No skill assessments recorded yet. Candidate must complete the AI Voice Assessment.
                </div>
              ) : (
                <div className="space-y-4">
                  {workerDetail.assessments.map((a: any, idx: number) => {
                    let parsedQuestions: any[] = [];
                    try {
                      if (a.answers_json) {
                        parsedQuestions = JSON.parse(a.answers_json);
                      }
                    } catch (e) {}

                    return (
                      <div key={idx} className="p-4 sm:p-5 bg-slate-50/70 border border-gray-200 rounded-2xl space-y-3 text-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/70 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm">{a.skill} Practical Assessment</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Language: {a.language === "ta" ? "தமிழ் (Tamil)" : a.language?.toUpperCase() || "EN"}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              a.status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : a.status === "RE_ASSESSMENT_REQUESTED"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {a.status || "PENDING_APPROVAL"}
                            </span>
                          </div>
                          <span className={`font-extrabold text-sm self-start sm:self-auto ${
                            a.score >= 60 ? "text-emerald-700" : "text-red-600"
                          }`}>
                            Score: {a.score}/100 ({a.score >= 60 ? "PASSED" : "FAILED"})
                          </span>
                        </div>

                        {/* If 10-question detailed breakdown is available */}
                        {parsedQuestions && parsedQuestions.length > 0 ? (
                          <div className="space-y-3 pt-1">
                            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                              Question-by-Question Voice Transcript & Scoring:
                            </span>
                            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                              {parsedQuestions.map((qItem: any, qIdx: number) => (
                                <div key={qIdx} className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-2xs">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-semibold text-gray-900 leading-snug">
                                      {qIdx + 1}. {qItem.question}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0 border ${
                                      qItem.score >= 6
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : "bg-amber-50 text-amber-800 border-amber-200"
                                    }`}>
                                      {qItem.score}/10 pts
                                    </span>
                                  </div>

                                  {qItem.spoken_answer && (
                                    <div className="text-[11px] text-gray-700 bg-slate-50 p-2 rounded-lg border border-gray-100">
                                      <span className="font-bold text-gray-500 block text-[10px] uppercase">Worker Voice Answer:</span>
                                      "{qItem.spoken_answer}"
                                    </div>
                                  )}

                                  {qItem.selected_option && (
                                    <div className="text-[11px] text-gray-600">
                                      <span className="font-medium text-gray-500">Selected Option: </span>
                                      {qItem.selected_option}
                                    </div>
                                  )}

                                  {qItem.feedback && (
                                    <div className="text-[11px] text-emerald-800 font-medium">
                                      ✓ AI Feedback: {qItem.feedback}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : a.voice_transcript ? (
                          <div className="p-2.5 bg-white border border-emerald-100 rounded-lg text-emerald-900 text-[11px]">
                            <span className="font-bold block text-[10px] text-emerald-600 uppercase">Voice Explanation:</span>
                            "{a.voice_transcript}"
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Document Verification links */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Verification Documents
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 block font-bold">GOVT IDENTITY PROOF</span>
                  <a
                    href={workerDetail.id_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline font-semibold mt-1 block truncate"
                  >
                    View Aadhaar/ID Document ↗
                  </a>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-400 block font-bold">SKILL / TRADE CERTIFICATE</span>
                  {workerDetail.cert_document_url ? (
                    <a
                      href={workerDetail.cert_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline font-semibold mt-1 block truncate"
                    >
                      View Certificate ↗
                    </a>
                  ) : (
                    <span className="text-gray-500 italic mt-1 block">Not attached (Verified via practical test)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-gray-100 flex flex-wrap justify-end gap-2.5">
              {workerDetail.status === "PENDING_VERIFICATION" ? (
                <>
                  <button
                    onClick={() => {
                      setActionType("REJECT");
                      setActionReason("");
                    }}
                    className="px-4 py-2 rounded-xl border border-red-200 text-red-600 font-semibold text-xs hover:bg-red-50"
                  >
                    Reject Candidate
                  </button>

                  <button
                    onClick={() => {
                      setActionType("REQUEST_REASSESSMENT");
                      setActionReason("Cooperative board requests that the worker retake the practical voice assessment with higher focus on trade safety and diagnostics.");
                    }}
                    className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-semibold text-xs hover:bg-amber-100"
                  >
                    Request Re-Assessment
                  </button>

                  <button
                    onClick={() => handleApprove(workerDetail.id)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Worker</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedWorkerId(null)}
                  className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold text-xs hover:bg-gray-200"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECT / REQUEST INFO / RE-ASSESSMENT MODAL */}
      {actionType && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {actionType === "REJECT" 
                ? "Reject Worker Application" 
                : actionType === "REQUEST_REASSESSMENT"
                ? "Request Skill Re-Assessment"
                : "Request More Information"}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason / Instructions for Applicant
              </label>
              <textarea
                rows={3}
                required
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={
                  actionType === "REQUEST_REASSESSMENT"
                    ? "Explain why the worker should retake the voice assessment (e.g. earthing safety needs improvement)..."
                    : "Enter rationale for applicant..."
                }
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setActionType(null)}
                className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={isProcessingAction}
                className={`w-2/3 py-2.5 rounded-xl font-semibold text-xs text-white shadow-xs ${
                  actionType === "REJECT"
                    ? "bg-red-600 hover:bg-red-700"
                    : actionType === "REQUEST_REASSESSMENT"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {isProcessingAction ? "Updating..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
