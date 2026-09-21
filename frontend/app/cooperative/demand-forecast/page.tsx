"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, BarChart3, AlertCircle, Sparkles, MapPin, Clock, ArrowRight, UserPlus } from "lucide-react";
import { api } from "@/lib/api";

export default function CooperativeDemandForecastPage() {
  const [forecast, setForecast] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.demandForecast.getForecast()
      .then(setForecast)
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
            Machine Learning Predictive Analytics
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Workforce Demand Forecasting
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Predict future service demand, regional trade bottlenecks, and proactively plan cooperative member recruitment
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading demand forecast models...</div>
      ) : !forecast?.sufficient_data ? (
        /* STRICT EMPTY STATE REQUIREMENT */
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-2xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <TrendingUp className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Not enough data for reliable forecasting yet.
          </h2>
          <p className="text-sm text-gray-600 max-w-lg mx-auto leading-relaxed">
            {forecast?.explanation || "Machine learning demand models require at least 8 completed service bookings to calculate statistically confident trends and seasonal patterns. No synthetic forecasts are generated."}
          </p>
          <div className="pt-2 text-xs text-gray-500">
            Current bookings recorded: <strong>{forecast?.total_bookings_analyzed || 0}</strong>
          </div>
        </div>
      ) : (
        /* LIVE FORECAST VIEW */
        <div className="space-y-8">
          {/* Top Recommendation: Skills likely to be needed */}
          <div className="bg-white border-2 border-purple-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-gray-900">
                Skills Likely to be Needed (Proactive Recruitment)
              </h2>
            </div>
            <p className="text-xs text-gray-600">
              The AI model has detected rising request velocities in the following trades. Cooperatives should recruit or train members in these disciplines:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {forecast.skills_needed?.map((s: any, idx: number) => (
                <div key={idx} className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 text-sm">{s.trade}</span>
                    <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-900 font-extrabold text-[10px]">
                      {s.priority}
                    </span>
                  </div>
                  <p className="text-gray-600 text-[11px] leading-relaxed">{s.reason}</p>
                  <span className="text-purple-800 font-semibold block pt-1">
                    Recruitment Target: +{s.recommended_recruitment} verified workers
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Demand Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Demand */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-base font-bold text-gray-900">Projected 7-Day Demand by Trade</h3>
              <div className="space-y-3">
                {forecast.category_forecast?.map((cat: any) => (
                  <div key={cat.category} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium text-gray-800">
                      <span>{cat.category}</span>
                      <span className="text-gray-500">
                        {cat.predicted_weekly_demand} bookings / wk ({cat.trend})
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, cat.demand_share_pct * 2)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Slot Peak Distribution */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-base font-bold text-gray-900">Peak Request Time Windows</h3>
              <div className="space-y-4">
                {forecast.time_forecast?.map((t: any) => (
                  <div key={t.slot} className="p-3.5 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-gray-900">{t.slot}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900">{t.count} bookings</span>
                      <span className="text-gray-400 text-[10px] block">{t.pct}% volume</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
