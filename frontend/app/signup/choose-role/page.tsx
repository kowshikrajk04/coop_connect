"use client";

import React from "react";
import Link from "next/link";
import { Users, Wrench, Building2, ArrowRight, ShieldCheck } from "lucide-react";

export default function ChooseRolePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4">
          <ShieldCheck className="w-4 h-4" />
          <span>CoopConnect Account Setup</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
          Choose your account type
        </h1>
        <p className="text-gray-600 mt-3 text-base">
          Please select the role that best describes your relationship with CoopConnect.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Customer Card */}
        <Link
          href="/signup/customer"
          className="group bg-white border-2 border-gray-200 hover:border-blue-500 rounded-2xl p-8 transition shadow-xs hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-105 transition">
              <Users className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Customer</h2>
            <p className="text-gray-600 mt-3 text-sm leading-relaxed">
              Book verified cooperative workers for home maintenance, repairs, caregiving, and daily assistance with fair, transparent pricing.
            </p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm font-bold text-blue-600 group-hover:translate-x-1 transition">
            <span>Register as Customer</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Worker Card */}
        <Link
          href="/signup/worker"
          className="group bg-white border-2 border-gray-200 hover:border-emerald-500 rounded-2xl p-8 transition shadow-xs hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-105 transition">
              <Wrench className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Worker</h2>
            <p className="text-gray-600 mt-3 text-sm leading-relaxed">
              Join your local cooperative, get fair job opportunities with no agency commission, practical voice skill assessment, and build your welfare fund.
            </p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm font-bold text-emerald-600 group-hover:translate-x-1 transition">
            <span>Register as Worker</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Cooperative Card */}
        <Link
          href="/signup/cooperative"
          className="group bg-white border-2 border-gray-200 hover:border-indigo-500 rounded-2xl p-8 transition shadow-xs hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-105 transition">
              <Building2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Cooperative</h2>
            <p className="text-gray-600 mt-3 text-sm leading-relaxed">
              Register your registered labour cooperative society to manage member verification, monitor fair work allocation, and access demand forecasting.
            </p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm font-bold text-indigo-600 group-hover:translate-x-1 transition">
            <span>Register Cooperative</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <div className="text-center mt-12 text-sm text-gray-500">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-blue-600 hover:underline">
          Sign In here
        </Link>
      </div>
    </div>
  );
}
