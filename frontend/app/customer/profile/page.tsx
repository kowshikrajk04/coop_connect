"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, MapPin, Phone, Mail, HelpCircle, LogOut, CheckCircle2, Shield } from "lucide-react";
import { api, clearAuthData } from "@/lib/api";

export default function CustomerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.customer.getProfile()
      .then((res) => {
        setProfile(res);
        setAddress(res.address || "");
      })
      .catch(() => {});
  }, []);

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.customer.updateProfile({ address });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message || "Failed to update address");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuthData();
    router.push("/login");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customer Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account information and default locations</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        {/* Personal Details */}
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 font-bold text-2xl flex items-center justify-center">
            {profile?.full_name ? profile.full_name.charAt(0) : "C"}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile?.full_name || "Customer"}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Registered CoopConnect Citizen Account</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Mobile Number</span>
            <div className="flex items-center gap-1.5 font-semibold text-gray-900 mt-1">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span>+91 {profile?.mobile || "9876543210"}</span>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Email Address</span>
            <div className="flex items-center gap-1.5 font-semibold text-gray-900 mt-1">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span>{profile?.email || "—"}</span>
            </div>
          </div>
        </div>

        {/* Address Update Form */}
        <form onSubmit={handleUpdateAddress} className="pt-4 border-t border-gray-100 space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Primary Service Address
          </label>
          <input
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500"
          />

          {saveSuccess && (
            <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Address saved successfully!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs"
          >
            {isSaving ? "Saving..." : "Update Address"}
          </button>
        </form>

        {/* Help & Support */}
        <div className="pt-6 border-t border-gray-100 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Cooperative Support & Help</h3>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 leading-relaxed">
            <p className="font-semibold mb-1">Need help with a worker or emergency booking?</p>
            Call the Cooperative Federation Helpline at <strong>1800-COOP-DELHI</strong> (toll-free, 7 AM - 9 PM) or email <strong>helpdesk@coopconnect.org</strong>.
          </div>
        </div>

        {/* Logout */}
        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
          <Link href="/customer/bookings" className="text-xs font-semibold text-blue-600 hover:underline">
            View All Bookings
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
