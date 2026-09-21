"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { 
  Users, Shield, Briefcase, UserCheck, Bell, LogOut, 
  Menu, X, Layers, CheckCircle2, AlertCircle
} from "lucide-react";
import { getUserRole, getUserName, clearAuthData, setAuthData, api } from "@/lib/api";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    const currentRole = getUserRole();
    const currentName = getUserName();
    setRole(currentRole);
    setName(currentName);

    if (currentRole) {
      api.notifications.getAll()
        .then((res) => setNotifications(res.notifications || []))
        .catch(() => {});
    }
  }, [pathname]);

  const handleLogout = () => {
    clearAuthData();
    setRole(null);
    setName(null);
    router.push("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 text-gray-900 group">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:bg-blue-700 transition">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-blue-900 block leading-tight">
                  CoopConnect
                </span>
                <span className="text-[11px] font-medium text-gray-500 block">
                  Fair Work • Stronger Communities
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Links based on Role */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {role === "CUSTOMER" && (
              <>
                <Link
                  href="/customer/dashboard"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/customer/dashboard"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Book a Service
                </Link>
                <Link
                  href="/customer/bookings"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname.startsWith("/customer/bookings")
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  My Bookings
                </Link>
                <Link
                  href="/customer/wallet"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/customer/wallet"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Wallet & Payments
                </Link>
                <Link
                  href="/customer/profile"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/customer/profile"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Profile
                </Link>
              </>
            )}

            {role === "WORKER" && (
              <>
                <Link
                  href="/worker/dashboard"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/worker/dashboard"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  My Jobs
                </Link>
                <Link
                  href="/worker/route"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/worker/route"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Route & Map
                </Link>
                <Link
                  href="/worker/assessment"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/worker/assessment"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Skill Test
                </Link>
                <Link
                  href="/worker/earnings"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/worker/earnings"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Earnings & Welfare
                </Link>
                <Link
                  href="/worker/profile"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/worker/profile"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Profile
                </Link>
              </>
            )}

            {role === "COOPERATIVE" && (
              <>
                <Link
                  href="/cooperative/dashboard"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/cooperative/dashboard"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Overview
                </Link>
                <Link
                  href="/cooperative/verification"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/cooperative/verification"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Verify Workers
                </Link>
                <Link
                  href="/cooperative/fair-allocation"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/cooperative/fair-allocation"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Fair Allocation
                </Link>
                <Link
                  href="/cooperative/welfare"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/cooperative/welfare"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Welfare Fund
                </Link>
                <Link
                  href="/cooperative/demand-forecast"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/cooperative/demand-forecast"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Demand Forecast
                </Link>
                <Link
                  href="/cooperative/settings"
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/cooperative/settings"
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                  }`}
                >
                  Settings
                </Link>
              </>
            )}

            {!role && (
              <>
                <Link
                  href="/#features"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                >
                  How It Works
                </Link>
                <Link
                  href="/#cooperatives"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                >
                  Worker Cooperatives
                </Link>
                <Link
                  href="/#welfare"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                >
                  Welfare Model
                </Link>
                <Link
                  href="/worker/assessment"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition"
                >
                  <span>🎙️ Voice Assessment</span>
                </Link>
              </>
            )}

            <Link
              href="/leaderboard"
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                pathname === "/leaderboard"
                  ? "text-blue-700 bg-blue-50 font-semibold"
                  : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
              }`}
            >
              <span>🏆 Leaderboard</span>
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {role ? (
              <div className="flex items-center gap-2.5">
                {/* Notification Bell */}
                <div className="relative">
                  <button
                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                    className="p-2 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition relative"
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {notifications.some((n) => !n.read) && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                    )}
                  </button>

                  {/* Dropdown */}
                  {isNotifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <span className="font-semibold text-sm text-gray-900">Notifications</span>
                        <span className="text-xs text-gray-500">{notifications.length} updates</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 mt-1">
                        {notifications.length === 0 ? (
                          <div className="py-6 text-center text-xs text-gray-400">
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div key={n.id} className="py-2.5 text-xs">
                              <p className="font-medium text-gray-800">{n.title}</p>
                              <p className="text-gray-500 mt-0.5">{n.message}</p>
                              <span className="text-[10px] text-gray-400 mt-1 block">{n.created_at}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Badge */}
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-900 leading-none">{name || "User"}</p>
                    <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">
                      {role}
                    </span>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 transition"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3.5 py-2 rounded-lg border border-gray-200 hover:border-blue-200 transition"
                >
                  Login
                </Link>
                <Link
                  href="/signup/choose-role"
                  className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  <span>Choose Account</span>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-gray-700" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 px-4 pt-2 pb-4 space-y-1">
          {role === "CUSTOMER" && (
            <>
              <Link href="/customer/dashboard" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Book a Service</Link>
              <Link href="/customer/bookings" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">My Bookings</Link>
              <Link href="/customer/wallet" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Wallet & Payments</Link>
              <Link href="/customer/profile" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Profile</Link>
            </>
          )}
          {role === "WORKER" && (
            <>
              <Link href="/worker/dashboard" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">My Jobs</Link>
              <Link href="/worker/route" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Route & Map</Link>
              <Link href="/worker/assessment" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Skill Test</Link>
              <Link href="/worker/earnings" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Earnings & Welfare</Link>
              <Link href="/worker/profile" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Profile</Link>
            </>
          )}
          {role === "COOPERATIVE" && (
            <>
              <Link href="/cooperative/dashboard" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Overview</Link>
              <Link href="/cooperative/verification" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Verify Workers</Link>
              <Link href="/cooperative/fair-allocation" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Fair Allocation</Link>
              <Link href="/cooperative/welfare" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Welfare Fund</Link>
              <Link href="/cooperative/demand-forecast" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Demand Forecast</Link>
              <Link href="/cooperative/settings" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Settings</Link>
            </>
          )}
          {!role && (
            <>
              <Link href="/worker/assessment" className="block px-3 py-2 rounded text-base font-medium text-emerald-700 hover:bg-emerald-50">🎙️ Worker AI Voice Assessment</Link>
              <Link href="/login" className="block px-3 py-2 rounded text-base font-medium text-gray-700 hover:bg-blue-50">Login</Link>
              <Link href="/signup/choose-role" className="block px-3 py-2 rounded text-base font-medium text-blue-600 hover:bg-blue-50">Choose Account Type</Link>
            </>
          )}
          <Link href="/leaderboard" className="block px-3 py-2 rounded text-base font-medium text-amber-700 hover:bg-amber-50">🏆 Worker Leaderboard</Link>
        </div>
      )}
    </header>
  );
}
