"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, AlertCircle, CheckCircle2, Mail, KeyRound, RotateCw } from "lucide-react";
import { api, setAuthData } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [loginMode, setLoginMode] = useState<"PASSWORD" | "OTP">("PASSWORD");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const redirectByRole = (res: { access_token: string; role: string; name: string; user_id: number }) => {
    setAuthData(res.access_token, res.role, res.name, res.user_id);
    if (res.role === "CUSTOMER") {
      router.push("/customer/dashboard");
    } else if (res.role === "WORKER") {
      router.push("/worker/dashboard");
    } else if (res.role === "COOPERATIVE") {
      router.push("/cooperative/dashboard");
    } else {
      router.push("/");
    }
  };

  const handlePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      const res = await api.auth.login(loginId.trim(), password);
      redirectByRole(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid mobile/email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendLoginOtp = async () => {
    const cleanId = loginId.trim();
    if (!cleanId) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }
    if (!cleanId.includes("@")) {
      setErrorMsg("Please enter a valid email address to receive an OTP.");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setIsOtpSending(true);

    try {
      const res = await api.auth.sendOtp({ email: cleanId, purpose: "login" });
      setSuccessMsg(res.message || "Verification code sent to your email.");
      setOtpSent(true);
      setCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send OTP. Please check your email or connection.");
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleOtpLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = loginId.trim();
    const cleanOtp = otpCode.trim();

    if (!cleanId) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }
    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMsg("Please enter the 6-digit OTP code.");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      const res = await api.auth.loginOtp(cleanId, cleanOtp);
      redirectByRole(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign In to CoopConnect</h1>
          <p className="text-xs text-gray-500 mt-1">Access your customer, worker, or cooperative portal</p>
        </div>

        {/* Login Method Toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setLoginMode("PASSWORD");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              loginMode === "PASSWORD"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("OTP");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              loginMode === "OTP"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Email OTP
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {loginMode === "PASSWORD" ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email or Mobile Number
              </label>
              <input
                type="text"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="e.g. customer@demo.com or 9876543210"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("OTP");
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Forgot? Use OTP
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <span>{isLoading ? "Signing In..." : "Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setLoginMode("OTP");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="text-xs text-gray-500 hover:text-blue-600 transition"
              >
                Prefer to sign in with Email OTP? <span className="font-semibold text-blue-600">Switch</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleOtpLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Registered Email Address
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={loginId}
                  onChange={(e) => {
                    setLoginId(e.target.value);
                    if (otpSent) setOtpSent(false);
                  }}
                  placeholder="e.g. customer@demo.com"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSendLoginOtp}
                  disabled={isOtpSending || cooldown > 0 || !loginId || !loginId.includes("@")}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  {isOtpSending ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span>Wait {cooldown}s</span>
                  ) : otpSent ? (
                    <span>Resend OTP</span>
                  ) : (
                    <span>Send OTP</span>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                We'll verify your registered account and provide a 6-digit code.
              </p>
            </div>

            {otpSent && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 123456"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm tracking-widest font-mono text-center text-lg"
                  autoFocus
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !otpSent || otpCode.length < 4}
              className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <span>{isLoading ? "Verifying & Signing In..." : "Sign In with OTP"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setLoginMode("PASSWORD");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="text-xs text-gray-500 hover:text-blue-600 transition"
              >
                Remember your password? <span className="font-semibold text-blue-600">Sign in with Password</span>
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-6 pt-6 border-t border-gray-100 text-xs text-gray-500">
          Don't have an account yet?{" "}
          <Link href="/signup/choose-role" className="font-semibold text-blue-600 hover:underline">
            Choose your account type
          </Link>
        </div>
      </div>
    </div>
  );
}
