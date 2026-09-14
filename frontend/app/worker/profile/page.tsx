"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench, Phone, Mail, Award, CheckCircle2, ShieldCheck, LogOut, FileText } from "lucide-react";
import { api, clearAuthData } from "@/lib/api";

export default function WorkerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.worker.getProfile().then(setProfile).catch(() => {});
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
          Review your cooperative membership status, trade assessment records, and identity files
        </p>
      </div>

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
