"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Wrench, CheckCircle2, ArrowRight, ArrowLeft, Mic, MicOff, 
  Volume2, AlertCircle, FileText, Upload, ShieldAlert, Award, ShieldCheck,
  MapPin, Loader2
} from "lucide-react";
import { api, setAuthData } from "@/lib/api";
import DocumentUpload from "@/components/DocumentUpload";
import { useCurrentLocation } from "@/lib/useCurrentLocation";

const TRADE_LIST = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "Painter",
  "Domestic Helper",
  "Caregiver",
  "Driver",
  "Gardener",
  "Cleaner",
  "Technician"
];

export default function WorkerSignupPage() {
  const router = useRouter();

  // Step 1 - Personal Info
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("1992-05-15");
  const [address, setAddress] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=300&q=80");

  // Step 2 - Skills
  const [selectedSkills, setSelectedSkills] = useState<{ [key: string]: number }>({
    "Electrician": 3
  });

  // Step 3 - Documents
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [certDocFile, setCertDocFile] = useState<File | null>(null);
  const [expProofFile, setExpProofFile] = useState<File | null>(null);
  const [idDocError, setIdDocError] = useState("");

  // Step 4 - Assessment
  const [assessmentLang, setAssessmentLang] = useState<"en" | "hi">("en");
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qId: string]: number }>({});
  const [voiceAnswers, setVoiceAnswers] = useState<{ [qId: string]: string }>({});
  const [isRecording, setIsRecording] = useState<{ [qId: string]: boolean }>({});
  const [speechSupported, setSpeechSupported] = useState(false);

  // Status
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const { isLocating, detect: detectLocation } = useCurrentLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [workerToken, setWorkerToken] = useState<string | null>(null);

  // OTP State for Worker Step 1
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendWorkerOtp = async () => {
    if (cooldown > 0 || otpLoading) return;
    setErrorMsg("");
    setSuccessMsg("");
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address first.");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await api.auth.sendOtp({ email, mobile });
      setSuccessMsg("Verification code sent to your email. Please check your inbox.");
      setOtpSent(true);
      setCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyWorkerOtp = async () => {
    if (otpCode.length < 4 || otpLoading) return;
    setErrorMsg("");
    setSuccessMsg("");
    setOtpLoading(true);
    try {
      const res = await api.auth.verifyOtp({ email, mobile }, otpCode);
      setSuccessMsg("Email verified successfully.");
      setOtpVerified(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired OTP code.");
    } finally {
      setOtpLoading(false);
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setSpeechSupported(true);
    }
  }, []);

  // Fetch assessment questions when reaching Step 4
  const primaryTrade = Object.keys(selectedSkills)[0] || "Electrician";
  useEffect(() => {
    if (currentStep === 4) {
      api.worker.getAssessmentQuestions(primaryTrade, assessmentLang)
        .then((res) => {
          setQuestions(res.questions || []);
        })
        .catch(() => {});
    }
  }, [currentStep, primaryTrade, assessmentLang]);

  // Voice recording handler
  const toggleVoiceRecording = (qId: string) => {
    if (isRecording[qId]) {
      setIsRecording((prev) => ({ ...prev, [qId]: false }));
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech-to-Text is not supported on this browser. You can type your answer below.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = assessmentLang === "hi" ? "hi-IN" : "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording((prev) => ({ ...prev, [qId]: true }));
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceAnswers((prev) => ({
          ...prev,
          [qId]: (prev[qId] ? prev[qId] + " " : "") + transcript,
        }));
      };

      recognition.onerror = (event: any) => {
        setIsRecording((prev) => ({ ...prev, [qId]: false }));
      };

      recognition.onend = () => {
        setIsRecording((prev) => ({ ...prev, [qId]: false }));
      };

      recognition.start();
    } catch (e) {
      setIsRecording((prev) => ({ ...prev, [qId]: false }));
    }
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!otpVerified) {
      setErrorMsg("Please verify your email address with OTP before proceeding to Step 2.");
      return;
    }

    setIsLoading(true);

    try {
      const regRes = await api.auth.register({
        role: "WORKER",
        full_name: fullName,
        mobile,
        email,
        password,
        address,
        dob,
      });

      setAuthData(regRes.access_token, regRes.role, regRes.name, regRes.user_id);
      setWorkerToken(regRes.access_token);
      setCurrentStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Registration failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(selectedSkills).length === 0) {
      setErrorMsg("Please select at least one trade skill.");
      return;
    }
    setErrorMsg("");
    setIsLoading(true);

    try {
      const skillsArray = Object.entries(selectedSkills).map(([name, exp]) => ({
        skill_name: name,
        years_experience: exp,
      }));
      await api.worker.updateSkills(skillsArray);
      setCurrentStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save skills.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIdDocError("");

    if (!idDocFile) {
      setIdDocError("Please select your Government Identity Document (Aadhaar / Voter ID).");
      setErrorMsg("Please upload your Government Identity Document to proceed.");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("id_document", idDocFile);
      formData.append("id_document_url", idDocFile.name);

      if (certDocFile) {
        formData.append("cert_document", certDocFile);
        formData.append("cert_document_url", certDocFile.name);
      }
      if (expProofFile) {
        formData.append("experience_proof", expProofFile);
        formData.append("experience_proof_url", expProofFile.name);
      }

      await api.worker.updateDocs(formData);
      setCurrentStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update documents.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      // Calculate practical test score
      let correct = 0;
      questions.forEach((q) => {
        if (selectedAnswers[q.id] === q.correct_index) {
          correct += 1;
        }
      });
      const totalQ = Math.max(1, questions.length);
      const score = Math.round((correct / totalQ) * 100);

      const allVoiceTranscripts = Object.values(voiceAnswers).join(" | ");

      await api.worker.submitAssessment({
        skill_name: primaryTrade,
        score,
        passed: score >= 60,
        language: assessmentLang,
        answers_json: JSON.stringify(selectedAnswers),
        voice_transcript: allVoiceTranscripts || "Diagnostic explanation verified by scenario answers.",
      });

      router.push("/worker/dashboard?registered=true");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit assessment.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Multi-step Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          <span>Step {currentStep} of 4</span>
          <span className="text-emerald-700 font-bold">
            {currentStep === 1 && "Personal Information"}
            {currentStep === 2 && "Trade Skills"}
            {currentStep === 3 && "Document Verification"}
            {currentStep === 4 && "Practical Skill Assessment"}
          </span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-2 transition-all duration-300"
            style={{ width: `${(currentStep / 4) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: Personal Information */}
        {currentStep === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="pb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Step 1: Personal Information</h2>
              <p className="text-xs text-gray-500 mt-0.5">Enter your official details for cooperative records</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sunil Kumar"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full px-4 py-2.5 rounded-r-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  {otpVerified ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendWorkerOtp}
                      disabled={cooldown > 0 || otpLoading || !email || !email.includes("@")}
                      className={`text-xs font-semibold flex items-center gap-1 ${
                        cooldown > 0 || !email || !email.includes("@")
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-emerald-600 hover:text-emerald-700 underline"
                      }`}
                    >
                      {otpLoading
                        ? "Sending..."
                        : cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : otpSent
                        ? "Resend OTP"
                        : "Send OTP"}
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  required
                  disabled={otpVerified}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (otpSent) setOtpSent(false);
                    if (otpVerified) setOtpVerified(false);
                  }}
                  placeholder="sunil@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />

                {otpSent && !otpVerified && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
                    <p className="text-xs text-emerald-900">
                      Enter the 6-digit OTP sent to <strong>{email}</strong>:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="w-1/2 text-center tracking-widest font-mono text-base py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyWorkerOtp}
                        disabled={otpLoading || otpCode.length < 4}
                        className="w-1/2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition disabled:opacity-50"
                      >
                        {otpLoading ? "Verifying..." : "Verify Email"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Create Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Residential Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. House No. 42, Gali 3, Lajpat Nagar IV, New Delhi"
                  className="w-full px-4 py-2.5 pr-36 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => detectLocation((addr) => setAddress(addr))}
                  disabled={isLocating}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-60"
                >
                  {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  <span>{isLocating ? "Detecting..." : "Use My Location"}</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <span>{isLoading ? "Saving..." : "Continue to Step 2: Trade Skills"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: Trade Skills */}
        {currentStep === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-5">
            <div className="pb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Step 2: Select Your Skills</h2>
              <p className="text-xs text-gray-500 mt-0.5">Select all the services you are capable of performing</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TRADE_LIST.map((trade) => {
                const isSelected = !!selectedSkills[trade];
                return (
                  <div
                    key={trade}
                    onClick={() => {
                      setSelectedSkills((prev) => {
                        const copy = { ...prev };
                        if (copy[trade]) {
                          delete copy[trade];
                        } else {
                          copy[trade] = 2; // default 2 years
                        }
                        return copy;
                      });
                    }}
                    className={`cursor-pointer p-3.5 rounded-xl border-2 transition ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold shadow-2xs"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{trade}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    {isSelected && (
                      <div className="mt-2 text-[11px] text-emerald-700">
                        Experience: {selectedSkills[trade]} yrs
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Experience Year sliders for selected skills */}
            {Object.keys(selectedSkills).length > 0 && (
              <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Years of Practical Experience
                </span>
                {Object.keys(selectedSkills).map((trade) => (
                  <div key={trade} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-800">{trade}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={selectedSkills[trade]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSelectedSkills((prev) => ({ ...prev, [trade]: val }));
                        }}
                        className="w-32 accent-emerald-600"
                      />
                      <span className="w-12 text-right font-semibold text-gray-900">
                        {selectedSkills[trade]} yrs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={isLoading || Object.keys(selectedSkills).length === 0}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
              >
                <span>Continue to Step 3: Verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Verification Documents */}
        {currentStep === 3 && (
          <form onSubmit={handleStep3Submit} className="space-y-5">
            <div className="pb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Step 3: Verification Documents</h2>
              <p className="text-xs text-gray-500 mt-0.5">Upload identity and optional experience credentials</p>
            </div>

            {/* Crucial Indian Cooperative Inclusive Banner */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed flex items-start gap-3">
              <Award className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Inclusive Cooperative Policy:</strong> You do NOT need formal diplomas or certificates to join. If you do not have certificates, you will easily qualify by answering the practical skill scenario questions in Step 4.
              </div>
            </div>

            <DocumentUpload
              id="worker-identity-document"
              label="Government Identity Document (Aadhaar / Voter ID)"
              required
              hintText="Click anywhere here to browse local files (PDF, JPG, JPEG, PNG)"
              value={idDocFile}
              onChange={(file) => {
                setIdDocFile(file);
                if (file) setIdDocError("");
              }}
              error={idDocError}
              onErrorChange={setIdDocError}
              accentColor="emerald"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <DocumentUpload
                  id="worker-skill-certificate"
                  label="Skill Certificate (Optional)"
                  required={false}
                  hintText="Browse certificate (PDF, JPG, PNG)"
                  value={certDocFile}
                  onChange={setCertDocFile}
                  accentColor="emerald"
                />
              </div>

              <div>
                <DocumentUpload
                  id="worker-experience-proof"
                  label="Previous Experience Proof (Optional)"
                  required={false}
                  hintText="Browse experience proof (PDF, JPG, PNG)"
                  value={expProofFile}
                  onChange={setExpProofFile}
                  accentColor="emerald"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-1/3 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
              >
                <span>Proceed to Practical Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: Online Practical Skill Assessment */}
        {currentStep === 4 && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
              <Mic className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Trade: {primaryTrade}
              </span>
              <h2 className="text-2xl font-bold text-gray-900">
                AI Voice-Based Skill Assessment
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                CoopConnect verifies practical skills without heavy reading or writing. You will be asked 10 trade scenario questions with full voice support in <strong>Tamil (தமிழ்)</strong>, English, Hindi, and more.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex items-center gap-2 font-bold text-gray-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Cooperative Verification Protocol:</span>
              </div>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Listen to AI-spoken questions with "Repeat" button.</li>
                <li>Tap to speak your answers in your native language.</li>
                <li>Instant AI practical safety feedback for each question.</li>
                <li>Your 10-question dossier is sent for Board review.</li>
              </ul>
            </div>

            <div className="space-y-3 pt-2 max-w-md mx-auto">
              <Link
                href={`/worker/assessment?trade=${encodeURIComponent(primaryTrade)}`}
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
              >
                <span>Launch AI Voice Assessment (தமிழ் / EN) 🎙️</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/worker/dashboard?registered=true"
                className="w-full py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold text-xs transition block text-center"
              >
                Go to Worker Dashboard (Take Assessment Later)
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
