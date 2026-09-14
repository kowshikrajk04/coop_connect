"use client";

import React, { useState, useEffect } from "react";
import { Settings, CheckCircle2, ShieldCheck, DollarSign, HeartHandshake } from "lucide-react";
import { api } from "@/lib/api";

export default function CooperativeSettingsPage() {
  const [settings, setSettings] = useState<any>({
    service_fee_pct: 5.0,
    welfare_pct: 5.0,
    reserve_pct: 40.0,
    training_pct: 25.0,
    emergency_pct: 20.0,
    pension_pct: 15.0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.cooperative.getSettings()
      .then(setSettings)
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.cooperative.updateSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cooperative Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure society commission ceilings, member welfare rates, and reserve allocation percentages
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved and actively applied to all new bookings!</span>
          </div>
        )}

        {/* Primary Pricing Split */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-900">Service Commission & Welfare Percentages</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Cooperative Service Fee (%)
              </label>
              <input
                type="number"
                min={1}
                max={15}
                step={0.5}
                value={settings.service_fee_pct}
                onChange={(e) => setSettings({ ...settings, service_fee_pct: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm font-semibold"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Covers platform administrative and audit costs (Current: {settings.service_fee_pct}%)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Member Welfare Contribution (%)
              </label>
              <input
                type="number"
                min={1}
                max={15}
                step={0.5}
                value={settings.welfare_pct}
                onChange={(e) => setSettings({ ...settings, welfare_pct: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm font-semibold"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Directly deducted for the collective welfare fund (Current: {settings.welfare_pct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Welfare Breakdown Allocation */}
        <div className="pt-4 border-t border-gray-100 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Welfare Fund Distribution Proportions</h2>
          <p className="text-xs text-gray-500">
            Determine how the collected welfare pool is divided among internal funds:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-gray-50 rounded-xl space-y-1">
              <span className="font-semibold text-gray-800 block">Reserve Fund (%)</span>
              <input
                type="number"
                value={settings.reserve_pct}
                onChange={(e) => setSettings({ ...settings, reserve_pct: parseFloat(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold"
              />
            </div>

            <div className="p-3 bg-gray-50 rounded-xl space-y-1">
              <span className="font-semibold text-gray-800 block">Training & Upskilling Support (%)</span>
              <input
                type="number"
                value={settings.training_pct}
                onChange={(e) => setSettings({ ...settings, training_pct: parseFloat(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold"
              />
            </div>

            <div className="p-3 bg-gray-50 rounded-xl space-y-1">
              <span className="font-semibold text-gray-800 block">Emergency Healthcare Relief (%)</span>
              <input
                type="number"
                value={settings.emergency_pct}
                onChange={(e) => setSettings({ ...settings, emergency_pct: parseFloat(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold"
              />
            </div>

            <div className="p-3 bg-gray-50 rounded-xl space-y-1">
              <span className="font-semibold text-gray-800 block">Worker Pension & Retirement Pool (%)</span>
              <input
                type="number"
                value={settings.pension_pct}
                onChange={(e) => setSettings({ ...settings, pension_pct: parseFloat(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition"
          >
            {isSaving ? "Saving Settings..." : "Save Financial Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
