"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Compass, MapPin, Navigation, Clock, CheckCircle2, 
  ArrowRight, Phone, ShieldCheck, User, AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";

export default function WorkerRoutePage() {
  const [routeData, setRouteData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.worker.getRoute()
      .then((res) => setRouteData(res))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Smart Logistics
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Route & Schedule Optimization
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Sequences your daily assigned customer jobs to minimize travel distance and fatigue
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-gray-400">Computing optimal route...</div>
      ) : !routeData?.has_active_jobs ? (
        /* Empty State */
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Compass className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">No active bookings to optimize</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2 mb-6">
            You do not have any accepted or in-progress jobs for today. Once you accept customer allocations, the AI will compute your shortest travel path.
          </p>
          <Link
            href="/worker/dashboard"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition inline-flex items-center gap-2"
          >
            <span>Check My Jobs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Next Customer Hero Card */}
          {routeData.next_customer && (
            <div className="bg-white border-2 border-blue-600 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
                    Up Next
                  </span>
                  <h2 className="text-2xl font-black text-gray-900">
                    {routeData.next_customer.customer_name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Service: <strong>{routeData.next_customer.service_type}</strong> (Booking #{routeData.next_customer.booking_number})
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={routeData.next_customer.navigation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition flex items-center gap-2"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Start Navigation</span>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Estimated Arrival (ETA)</span>
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm mt-1">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>~{routeData.next_customer.eta_minutes} mins</span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Travel Distance</span>
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm mt-1">
                    <Compass className="w-4 h-4 text-blue-600" />
                    <span>{routeData.next_customer.distance_from_previous_km} km</span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Customer Contact</span>
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm mt-1">
                    <Phone className="w-4 h-4 text-blue-600" />
                    <span>+91 {routeData.next_customer.customer_mobile || "Verified"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span><strong>Destination Address:</strong> {routeData.next_customer.address}</span>
              </div>
            </div>
          )}

          {/* Interactive Map & Waypoints Visualization */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Optimized Stop Sequence</h3>
                <p className="text-xs text-gray-500">
                  Total Journey: <strong>{routeData.total_distance_km} km</strong> across <strong>{routeData.total_stops} customer stops</strong>
                </p>
              </div>
            </div>

            {/* Visual Route Sequence Line */}
            <div className="space-y-4 pt-4">
              {/* Start Point */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-xs">
                    Start
                  </div>
                  <div className="w-0.5 h-12 bg-gray-200 my-1"></div>
                </div>
                <div className="text-xs pt-1">
                  <span className="font-bold text-gray-900 block">Worker Departure Point</span>
                  <span className="text-gray-500">{routeData.worker_start?.address || "Registered Location"}</span>
                </div>
              </div>

              {/* Waypoints */}
              {routeData.stops.map((stop: any, idx: number) => (
                <div key={stop.booking_id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {idx + 1}
                    </div>
                    {idx < routeData.stops.length - 1 && (
                      <div className="w-0.5 h-12 bg-blue-200 my-1"></div>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 flex-1 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-gray-900 text-sm block">
                        Stop #{idx + 1}: {stop.customer_name}
                      </span>
                      <span className="text-gray-600">{stop.service_type} • #{stop.booking_number}</span>
                      <p className="text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span>{stop.address}</span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right flex-shrink-0">
                      <span className="text-blue-700 font-semibold block">+{stop.distance_from_previous_km} km</span>
                      <span className="text-gray-400 block text-[11px]">ETA ~{stop.eta_minutes} mins</span>
                      <a
                        href={stop.navigation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Directions</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
