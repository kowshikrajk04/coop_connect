"use client";

import React from "react";
import Link from "next/link";
import { 
  ShieldCheck, Scale, Compass, HeartHandshake, Building2, 
  TrendingUp, ArrowRight, CheckCircle2, Users, Wrench, 
  Zap, Droplet, Hammer, Paintbrush, Home, Heart, Car, Flower2, Sparkles, Cpu
} from "lucide-react";

export default function LandingPage() {
  const serviceCategories = [
    { name: "Electrician", icon: Zap, desc: "Wiring, switchboards, MCBs & appliance repairs" },
    { name: "Plumber", icon: Droplet, desc: "Leakages, pipe fittings, taps & water pressure" },
    { name: "Carpenter", icon: Hammer, desc: "Door repairs, furniture, locks & cabinetry" },
    { name: "Painter", icon: Paintbrush, desc: "Wall touch-ups, waterproofing & full painting" },
    { name: "Domestic Helper", icon: Home, desc: "Daily household assistance & cooking support" },
    { name: "Caregiver", icon: Heart, desc: "Elderly care, patient support & companionship" },
    { name: "Driver", icon: Car, desc: "Verified personal & commercial drivers" },
    { name: "Gardener", icon: Flower2, desc: "Lawn upkeep, pruning, potting & plant health" },
    { name: "Cleaner", icon: Sparkles, desc: "Deep cleaning, floor scrubbing & sanitization" },
    { name: "Technician", icon: Cpu, desc: "Air conditioner, refrigerator & home electronics" },
  ];

  const corePillars = [
    {
      icon: ShieldCheck,
      title: "1. Verified Cooperative Workers",
      desc: "Every worker belongs to a legally registered labour cooperative, vetted through rigorous identity checks and practical trade assessments.",
    },
    {
      icon: Scale,
      title: "2. Fair AI-Based Allocation",
      desc: "Our opportunity-aware algorithm avoids repeatedly assigning jobs to a select few, distributing work equitably among all qualified members.",
    },
    {
      icon: CheckCircle2,
      title: "3. Transparent Pricing",
      desc: "Strictly regulated transparent rates. You see exactly what goes to worker wages, cooperative overhead, and the welfare fund.",
    },
    {
      icon: Compass,
      title: "4. Route & Schedule Optimization",
      desc: "Minimizes worker travel distance and fatigue through intelligent waypoint sequencing and turn-by-turn navigation.",
    },
    {
      icon: HeartHandshake,
      title: "5. Dedicated Worker Welfare",
      desc: "Every completed booking contributes to a collective reserve for health emergencies, skill upskilling, and retirement support.",
    },
    {
      icon: Building2,
      title: "6. Democratic Cooperative Management",
      desc: "Cooperatives maintain full autonomy over worker verification, member welfare distributions, and dispute resolutions.",
    },
    {
      icon: TrendingUp,
      title: "7. Demand Forecasting",
      desc: "Machine learning analyses trade demand trends to help cooperatives proactively recruit, train, and prepare skilled workforces.",
    },
  ];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center border-b border-gray-100">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold mb-6 border border-blue-100">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Registered Labour Cooperative Marketplace</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight max-w-4xl mx-auto">
          Fair Work • <span className="text-blue-600">Stronger Communities</span>
        </h1>

        <p className="mt-5 text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto font-normal leading-relaxed">
          CoopConnect connects households and businesses with verified workers from registered labour cooperatives. Powered by fairness-aware AI allocation, transparent pricing, and direct worker welfare.
        </p>

        {/* Big Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup/choose-role"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-base shadow-sm hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <span>Choose Your Account Type</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/customer/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-gray-800 font-semibold text-base border border-gray-300 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-center gap-2"
          >
            <span>Book a Service</span>
          </Link>
          <Link
            href="/worker/assessment"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-50 text-emerald-800 font-semibold text-base border border-emerald-300 hover:bg-emerald-100 transition flex items-center justify-center gap-2"
          >
            <span>🎙️ Worker AI Voice Assessment</span>
          </Link>
        </div>
      </section>

      {/* Role Selection Cards Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Choose Your Account Type</h2>
          <p className="text-gray-600 mt-2 text-base">Select how you would like to participate in CoopConnect</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Customer */}
          <div className="bg-white border-2 border-blue-100 rounded-2xl p-8 hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Customer</h3>
              <p className="text-gray-600 mt-3 text-sm leading-relaxed">
                Book verified, cooperative-certified tradespeople for your home or office. Experience transparent rates, priority emergency handling, and digital payment with verified invoices.
              </p>
              <ul className="mt-6 space-y-2 text-xs text-gray-600 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>100% Verified trade workers</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Transparent cooperative pricing with UPI</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Fairness-vetted service allocations</span>
                </li>
              </ul>
            </div>
            <Link
              href="/signup/customer"
              className="mt-8 block text-center py-3 px-4 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
            >
              Sign Up as Customer
            </Link>
          </div>

          {/* Card 2: Worker */}
          <div className="bg-white border-2 border-emerald-100 rounded-2xl p-8 hover:border-emerald-400 hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                <Wrench className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Worker</h3>
              <p className="text-gray-600 mt-3 text-sm leading-relaxed">
                Join a registered labour cooperative. Benefit from fair AI job allocation, skill assessments with voice input, optimized daily travel routes, and a personal welfare fund.
              </p>
              <ul className="mt-6 space-y-2 text-xs text-gray-600 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Fair job distribution with Opportunity Gap protection</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Voice-supported multilingual trade assessment</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Automatic welfare credits for healthcare & pension</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 space-y-2">
              <Link
                href="/signup/worker"
                className="block text-center py-3 px-4 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition"
              >
                Sign Up as Worker
              </Link>
              <Link
                href="/worker/assessment"
                className="block text-center py-2 px-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-semibold text-xs hover:bg-emerald-100 transition"
              >
                🎙️ Take AI Voice Assessment
              </Link>
            </div>
          </div>

          {/* Card 3: Cooperative */}
          <div className="bg-white border-2 border-indigo-100 rounded-2xl p-8 hover:border-indigo-400 hover:shadow-md transition flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Cooperative</h3>
              <p className="text-gray-600 mt-3 text-sm leading-relaxed">
                Empower your labour society. Review and verify member profiles, inspect fair allocation balance, govern transparent welfare funds, and access AI demand forecasting.
              </p>
              <ul className="mt-6 space-y-2 text-xs text-gray-600 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span>Member verification & dossier inspection</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span>Transparent welfare ledger (reserve, training, pension)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span>Machine learning trade demand forecasting</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 space-y-2">
              <Link
                href="/signup/cooperative"
                className="block text-center py-3 px-4 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
              >
                Register Cooperative
              </Link>
              <Link
                href="/cooperative/dashboard"
                className="block text-center py-2 px-4 rounded-xl bg-indigo-50 border border-indigo-300 text-indigo-800 font-semibold text-xs hover:bg-indigo-100 transition"
              >
                🏛️ Cooperative Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 10 Registered Service Trades */}
      <section className="py-16 bg-slate-50/50 border-t border-b border-gray-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">10 Cooperative Service Trades</h2>
            <p className="text-gray-600 mt-2 text-base">Verified, certified, and fairly compensated trade workers</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {serviceCategories.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-blue-400 hover:shadow-xs transition flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-gray-900 text-base">{item.name}</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{item.desc}</p>
                  </div>
                  <Link
                    href={`/customer/dashboard?category=${encodeURIComponent(item.name)}`}
                    className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                  >
                    <span>Request</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7 Core CoopConnect Pillars */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">The Cooperative Difference</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2">
            Built for Dignity, Equity, and Transparency
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mt-3 text-base">
            Why CoopConnect differs fundamentally from ordinary commercial gig platforms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {corePillars.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-2xs">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{p.title}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
