"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Wrench, CheckCircle2, ArrowRight, ArrowLeft, Mic, MicOff, 
  Volume2, AlertCircle, FileText, Upload, ShieldAlert, Award, ShieldCheck
} from "lucide-react";
import { api, setAuthData } from "@/lib/api";

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
  const [idDocUrl, setIdDocUrl] = useState("https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80");
  const [certDocUrl, setCertDocUrl] = useState("");
  const [expProofUrl, setExpProofUrl] = useState("");

  // Step 4 - Assessment
  const [assessmentLang, setAssessmentLang] = useState<"en" | "hi">("en");
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qId: string]: number }>({});
  const [voiceAnswers, setVoiceAnswers] = useState<{ [qId: string]: string }>({});
  const [isRecording, setIsRecording] = useState<{ [qId: string]: boolean }>({});
  const [speechSupported, setSpeechSupported] = useState(false);

  // Status
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [workerToken, setWorkerToken] = useState<string | null>(null);

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
    setIsLoading(true);

    try {
      await api.worker.updateDocs({
        id_document_url: idDocUrl,
        cert_document_url: certDocUrl || null,
        experience_proof_url: expProofUrl || null,
      });
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sunil@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
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
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. House No. 42, Gali 3, Lajpat Nagar IV, New Delhi"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Government Identity Document (Aadhaar / Voter ID) <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition">
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <span className="text-xs text-gray-600 block">Document link / Simulated photo attached</span>
                <input
                  type="text"
                  required
                  value={idDocUrl}
                  onChange={(e) => setIdDocUrl(e.target.value)}
                  className="mt-2 w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Skill Certificate (Optional)
                </label>
                <input
                  type="text"
                  value={certDocUrl}
                  onChange={(e) => setCertDocUrl(e.target.value)}
                  placeholder="Optional certificate link / photo"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Previous Experience Proof (Optional)
                </label>
                <input
                  type="text"
                  value={expProofUrl}
                  onChange={(e) => setExpProofUrl(e.target.value)}
                  placeholder="Optional reference letter"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs"
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
