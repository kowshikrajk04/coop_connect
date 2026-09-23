"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  Award, CheckCircle2, Mic, AlertCircle, 
  ArrowRight, ShieldCheck, Volume2, RotateCcw,
  Sparkles, Square, Check, ArrowLeft
} from "lucide-react";
import { api } from "@/lib/api";
import { getTradeAssessmentQuestions, evaluateAssessmentAnswer } from "@/lib/assessmentData";

const TRADES = [
  "Plumber", "Electrician", "Carpenter", "Painter", 
  "Cleaner", "Caregiver", "Driver", "Gardener", 
  "Domestic Helper", "Technician"
];

const LANGUAGES = [
  { code: "ta", label: "Tamil", native: "தமிழ்", speechCode: "ta-IN", badge: "முழு குரல் ஆதரவு" },
  { code: "en", label: "English", native: "English", speechCode: "en-IN", badge: "Full Voice" },
  { code: "hi", label: "Hindi", native: "हिंदी", speechCode: "hi-IN", badge: "Voice Support" },
  { code: "te", label: "Telugu", native: "తెలుగు", speechCode: "te-IN", badge: "Voice Support" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", speechCode: "kn-IN", badge: "Voice Support" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", speechCode: "ml-IN", badge: "Voice Support" },
  { code: "bn", label: "Bengali", native: "বাংলা", speechCode: "bn-IN", badge: "Voice Support" },
  { code: "mr", label: "Marathi", native: "मराठी", speechCode: "mr-IN", badge: "Voice Support" },
];

interface QuestionItem {
  id: string;
  q_no: number;
  question: string;
  question_en?: string;
  question_ta?: string;
  options?: string[];
  correct_index?: number;
  explanation?: string;
  voice_prompt?: string;
  voice_prompt_en?: string;
  voice_prompt_ta?: string;
  key_concepts?: string[];
}

interface EvaluationResult {
  score: number;
  correctness: string;
  feedback: string;
  safety_awareness: string;
  practical_knowledge: string;
  ai_configured?: boolean;
  notice?: string;
}

interface AnswerDossier {
  question_id: string;
  question_number: number;
  question: string;
  transcribed_answer: string;
  score: number;
  AI_feedback: string;
  correctness: string;
  safety_awareness: string;
}

function AssessmentContent() {
  const searchParams = useSearchParams();
  const initialTrade = searchParams.get("trade") || "Plumber";

  // Flow State
  const [step, setStep] = useState<"LANGUAGE_SELECT" | "ASSESSMENT" | "RESULTS">("LANGUAGE_SELECT");
  const [selectedTrade, setSelectedTrade] = useState(initialTrade);
  const [language, setLanguage] = useState("ta"); // Tamil as mandatory default

  // Questions and Progress
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Speech Synthesis (TTS) State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [tamilVoiceWarning, setTamilVoiceWarning] = useState(false);

  // Speech Recognition (STT) State
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  // Assistant & Voice Status: 'IDLE' | 'AI_SPEAKING' | 'YOUR_TURN' | 'LISTENING' | 'ANSWER_DETECTED' | 'EVALUATING' | 'EVALUATED'
  const [voiceStatus, setVoiceStatus] = useState<
    "IDLE" | "AI_SPEAKING" | "YOUR_TURN" | "LISTENING" | "ANSWER_DETECTED" | "EVALUATING" | "EVALUATED"
  >("IDLE");

  // Test Voice State
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testVoiceSuccess, setTestVoiceSuccess] = useState<boolean | null>(null);

  // Evaluation, Dossier and Score State
  const [answersDossier, setAnswersDossier] = useState<Record<number, AnswerDossier>>({});
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
  const [finalScore, setFinalScore] = useState<any>(null);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);

  // Audio References
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeRecognitionRef = useRef<any>(null);
  const lastSpokenQIndexRef = useRef<number | null>(null);

  // 1. Initialize Voices & Browser Speech Recognition detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Speech Recognition check
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionClass) {
        setIsSupported(false);
      }

      // Speech Synthesis voices
      if ("speechSynthesis" in window) {
        const updateVoices = () => {
          const list = window.speechSynthesis.getVoices();
          if (list && list.length > 0) {
            setVoices(list);
          }
        };
        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;
        // Periodic check in case onvoiceschanged does not fire in some Chromium builds
        const timer = setTimeout(updateVoices, 300);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (activeRecognitionRef.current) {
        try { activeRecognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  // Voice finder: Finds best matching system voice for language, with graceful fallback
  // Requirement: "Prefer Tamil voice if a Tamil voice is available; otherwise gracefully fall back to an available voice."
  interface ResolvedVoiceInfo {
    voice: SpeechSynthesisVoice | null;
    lang: string;
    isNative: boolean;
  }

  const resolveVoice = (
    langCode: string,
    voiceList: SpeechSynthesisVoice[]
  ): ResolvedVoiceInfo => {
    const list =
      voiceList && voiceList.length > 0
        ? voiceList
        : typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis.getVoices()
        : [];

    if (!list || list.length === 0) {
      const target = LANGUAGES.find((l) => l.code === langCode);
      return {
        voice: null,
        lang: target ? target.speechCode : (langCode === "ta" ? "ta-IN" : "en-IN"),
        isNative: false,
      };
    }

    const target = LANGUAGES.find((l) => l.code === langCode);
    const speechCode = (target?.speechCode || "ta-IN").toLowerCase().replace("_", "-");
    const shortCode = langCode.toLowerCase();

    // 1. Exact match (e.g. ta-IN, hi-IN)
    let found = list.find((v) => v.lang.toLowerCase().replace("_", "-") === speechCode);
    if (found) return { voice: found, lang: found.lang, isNative: true };

    // 2. Starts with speechCode (e.g. ta-in-*)
    found = list.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(speechCode));
    if (found) return { voice: found, lang: found.lang, isNative: true };

    // 3. Starts with short language code (e.g. ta)
    found = list.find((v) => v.lang.toLowerCase().startsWith(shortCode));
    if (found) return { voice: found, lang: found.lang, isNative: true };

    // 4. Name contains language name (e.g. "Tamil", "தமிழ்", "Valluvar")
    if (target) {
      found = list.find((v) => {
        const vName = v.name.toLowerCase();
        return (
          vName.includes(target.label.toLowerCase()) ||
          vName.includes(target.native.toLowerCase()) ||
          (langCode === "ta" && (vName.includes("tamil") || vName.includes("valluvar")))
        );
      });
      if (found) return { voice: found, lang: found.lang, isNative: true };
    }

    // 5. Graceful Fallback if native voice is not installed on OS:
    // Try Indian English first
    let fallback = list.find((v) => {
      const l = v.lang.toLowerCase().replace("_", "-");
      return l.includes("en-in") || v.name.toLowerCase().includes("india");
    });
    if (fallback) return { voice: fallback, lang: fallback.lang, isNative: false };

    // Try default voice
    fallback = list.find((v) => v.default);
    if (fallback) return { voice: fallback, lang: fallback.lang, isNative: false };

    // Try any English voice
    fallback = list.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (fallback) return { voice: fallback, lang: fallback.lang, isNative: false };

    // Fall back to first available voice in system
    return { voice: list[0], lang: list[0].lang, isNative: false };
  };

  // Stop any active audio or speech
  const stopAllAudio = () => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
      } catch (e) {}
      activeAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    setIsSpeaking(false);
  };

  // =========================================================================
  // 2. BACKEND NEURAL TTS (primary) → Browser SpeechSynthesis (fallback)
  // Uses /api/assessment/tts for Tamil, Hindi, Telugu etc. — Microsoft Neural voices
  // Falls back to browser speechSynthesis only if backend TTS fails
  // =========================================================================
  const speakQuestion = (
    text: string,
    langCode: string = language,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    },
    fallbackText?: string
  ) => {
    stopAllAudio();
    setIsSpeaking(true);
    if (callbacks?.onStart) callbacks.onStart();

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const ttsUrl = `${API_BASE}/api/assessment/tts?text=${encodeURIComponent(text.trim())}&lang=${langCode}`;

    const audio = new Audio(ttsUrl);
    activeAudioRef.current = audio;

    audio.onended = () => {
      setIsSpeaking(false);
      activeAudioRef.current = null;
      if (callbacks?.onEnd) callbacks.onEnd();
    };

    audio.onerror = () => {
      // Backend TTS failed — fall back to browser speech synthesis
      activeAudioRef.current = null;
      const textToSpeak = fallbackText || text;
      _browserSpeak(textToSpeak, langCode, callbacks);
    };

    audio.play().catch(() => {
      // Autoplay blocked or error — fall back
      activeAudioRef.current = null;
      const textToSpeak = fallbackText || text;
      _browserSpeak(textToSpeak, langCode, callbacks);
    });
  };

  // Browser SpeechSynthesis fallback
  const _browserSpeak = (
    text: string,
    langCode: string,
    callbacks?: { onStart?: () => void; onEnd?: () => void; onError?: (err: any) => void }
  ) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSpeaking(false);
      if (callbacks?.onEnd) callbacks.onEnd();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const currentVoices = window.speechSynthesis.getVoices();
      const list = currentVoices.length > 0 ? currentVoices : voices;
      const resolved = resolveVoice(langCode, list);

      const utterance = new SpeechSynthesisUtterance(text);
      activeUtteranceRef.current = utterance;
      (window as any).__activeUtterance = utterance;

      if (resolved.voice) {
        utterance.voice = resolved.voice;
        utterance.lang = resolved.lang;
      } else {
        const target = LANGUAGES.find((l) => l.code === langCode);
        utterance.lang = target ? target.speechCode : "en-IN";
      }
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
        if (callbacks?.onEnd) callbacks.onEnd();
      };
      utterance.onend = finish;
      utterance.onerror = (e) => {
        if (callbacks?.onError) callbacks.onError(e);
        finish();
      };

      const watchdog = setTimeout(finish, Math.min(20000, Math.max(3000, text.length * 90)));
      utterance.addEventListener("end", () => clearTimeout(watchdog), { once: true });

      setTimeout(() => {
        try { window.speechSynthesis.speak(utterance); } catch { finish(); }
      }, 25);
    } catch {
      setIsSpeaking(false);
      if (callbacks?.onEnd) callbacks.onEnd();
    }
  };

  // Test Voice Handler on Language Selection Screen
  // Directly invoked from user click so browser autoplay policies are fully satisfied
  const handleTestVoice = () => {
    stopAllAudio();
    setIsTestingVoice(true);
    setTestVoiceSuccess(null);
    setMicError(null);

    // Direct user-click gesture activation
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }

    const nativeMessages: Record<string, string> = {
      ta: "வணக்கம். இது உங்கள் திறன் மதிப்பீடு. முதல் கேள்விக்கு தயாராகுங்கள்.",
      en: "Hello. This is your skill assessment. Get ready for the first question.",
      hi: "नमस्ते। यह आपका कौशल मूल्यांकन है। पहले प्रश्न के लिए तैयार हो जाइए।",
      te: "నమస్కారం. ఇది మీ నైపుణ్య అంచనా. మొదటి ప్రశ్నకు సిద్ధంగా ఉండండి.",
      kn: "ನಮಸ್ಕಾರ. ಇದು உங்கள் திறன் மதிப்பீடு. முதல் கேள்விக்கு சಿದ್ಧರಾಗಿ.",
      ml: "നമസ്കാരം. ഇത് നിങ്ങളുടെ நைபுண்ய மதிப்பீடு. முதல் கேள்விக்கு தயாராகுங்கள்.",
      bn: "নমস্কার। এটি আপনার दक्षता মূল্যায়ন। প্রথম প্রশ্নের জন্য প্রস্তুত হন।",
      mr: "नमस्कार. हे आपले कौशल्य मूल्यांकन आहे. पहिल्या प्रश्नासाठी सज्ज व्हा."
    };

    const fallbackMessages: Record<string, string> = {
      ta: "Vanakkam. This is your CoopConnect worker skill assessment. Voice test successful.",
      en: "Hello. This is your skill assessment. Voice test successful.",
      hi: "Namaste. This is your skill assessment. Voice test successful.",
      te: "Namaskaram. This is your skill assessment. Voice test successful.",
      kn: "Namaskara. This is your skill assessment. Voice test successful.",
      ml: "Namaskaram. This is your skill assessment. Voice test successful.",
      bn: "Nomoshkar. This is your skill assessment. Voice test successful.",
      mr: "Namaskar. This is your skill assessment. Voice test successful."
    };

    const textNative = nativeMessages[language] || nativeMessages["en"];
    const textFallback = fallbackMessages[language] || fallbackMessages["en"];

    speakQuestion(
      textNative,
      language,
      {
        onStart: () => {
          setIsTestingVoice(true);
        },
        onEnd: () => {
          setIsTestingVoice(false);
          setTestVoiceSuccess(true);
        },
        onError: (err) => {
          console.warn("Test voice notice:", err);
          setIsTestingVoice(false);
          if (err?.error !== "canceled" && err?.error !== "interrupted") {
            setTestVoiceSuccess(false);
          }
        }
      },
      textFallback
    );
  };

  // 3. Speech-to-Text (STT)
  const startListening = () => {
    // Stop any active audio or speech immediately
    stopAllAudio();

    setMicError(null);
    setCurrentTranscript("");

    const SpeechRecognitionClass = typeof window !== "undefined"
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;

    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      setMicError(
        language === "ta"
          ? "குரல் அறிதல் இந்த உலாவியில் ஆதரிக்கப்படவில்லை. Google Chrome உலாவியைப் பயன்படுத்தவும்."
          : "Voice assessment is not supported in this browser. Please use Google Chrome on a supported device."
      );
      setVoiceStatus("YOUR_TURN");
      return;
    }

    // Safely abort previous recognition if active
    if (activeRecognitionRef.current) {
      try { activeRecognitionRef.current.abort(); } catch (e) {}
      activeRecognitionRef.current = null;
    }

    try {
      const rec = new SpeechRecognitionClass();
      const targetLang = LANGUAGES.find((l) => l.code === language);
      rec.lang = targetLang ? targetLang.speechCode : "ta-IN";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
        setVoiceStatus("LISTENING");
      };

      rec.onresult = (event: any) => {
        let finalStr = "";
        let interimStr = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript;
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }
        const text = (finalStr || interimStr).trim();
        if (text) {
          setCurrentTranscript(text);
          setVoiceStatus("ANSWER_DETECTED");
        }
      };

      rec.onerror = (e: any) => {
        console.warn("STT error:", e);
        setIsListening(false);
        if (e.error === "not-allowed") {
          setMicError(
            language === "ta"
              ? "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. தயவுசெய்து முகவரிப் பட்டியில் மைக் அனுமதியை இயக்கவும்."
              : "Microphone permission denied. Please allow microphone access in your browser."
          );
        } else if (e.error === "no-speech") {
          setMicError(
            language === "ta"
              ? "பேச்சு எதுவும் கேட்கவில்லை. 'பதிலளிக்க பேசவும்' பொத்தானை அழுத்தி தெளிவாகப் பேசவும்."
              : "No speech detected. Please tap Answer and speak clearly."
          );
        } else if (e.error === "network") {
          setMicError(
            language === "ta"
              ? "குரல் அறிதலில் இணைய பிழை. உங்கள் இணைய இணைப்பை சரிபார்க்கவும்."
              : "Network error occurred during speech recognition."
          );
        }
        setVoiceStatus("YOUR_TURN");
      };

      rec.onend = () => {
        setIsListening(false);
        if (voiceStatus === "LISTENING") {
          setVoiceStatus(currentTranscript ? "ANSWER_DETECTED" : "YOUR_TURN");
        }
      };

      activeRecognitionRef.current = rec;
      rec.start();
    } catch (err: any) {
      console.warn("Failed to start speech recognition:", err);
      setIsListening(false);
      setVoiceStatus("YOUR_TURN");
    }
  };

  const stopListening = () => {
    if (activeRecognitionRef.current) {
      try { activeRecognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
    if (currentTranscript.trim()) {
      setVoiceStatus("ANSWER_DETECTED");
    } else {
      setVoiceStatus("YOUR_TURN");
    }
  };

  // 4. Start Assessment Flow (Triggered by user clicking START ASSESSMENT)
  const handleStartTest = async () => {
    // Resume browser audio in user gesture
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.resume();
      } catch (e) {}
    }

    setIsLoadingQuestions(true);
    setTamilVoiceWarning(false);
    setMicError(null);

    let list: QuestionItem[] = [];

    // 1. Try fetching questions from API
    try {
      const res = await api.assessment.getQuestions(selectedTrade, language);
      if (res && res.questions && Array.isArray(res.questions) && res.questions.length >= 10) {
        list = res.questions;
      }
    } catch (e: any) {
      console.warn("API questions fetch notice, using built-in question bank:", e);
    }

    // 2. Seamless local fallback if API fails or on Vercel
    if (!list || list.length === 0) {
      list = getTradeAssessmentQuestions(selectedTrade, language);
    }

    // 3. Validate questions
    if (!list || list.length === 0) {
      setMicError(
        language === "ta"
          ? "கேள்விகளை ஏற்றுவதில் சிக்கல் ஏற்பட்டது. தயவுசெய்து பக்கத்தை புதுப்பிக்கவும்."
          : "Could not load questions. Please refresh the page."
      );
      setIsLoadingQuestions(false);
      return;
    }

    setQuestions(list);
    setCurrentIndex(0);
    setAnswersDossier({});
    setCurrentEvaluation(null);
    setCurrentTranscript("");
    lastSpokenQIndexRef.current = 0;
    setStep("ASSESSMENT");
    setVoiceStatus("AI_SPEAKING");
    setIsLoadingQuestions(false);

    // Auto-speak Question 1 out loud immediately upon starting
    const q1 = list[0];
    const q1Native = q1.voice_prompt || q1.question;
    const q1Fallback = q1.voice_prompt_en || q1.question_en || q1.question;
    setTimeout(() => {
      speakQuestion(
        q1Native,
        language,
        {
          onStart: () => {
            setVoiceStatus("AI_SPEAKING");
          },
          onEnd: () => {
            setVoiceStatus("YOUR_TURN");
          },
          onError: () => {
            setVoiceStatus("YOUR_TURN");
          }
        },
        q1Fallback
      );
    }, 150);
  };

  // Current Active Question
  const currentQ = questions[currentIndex];

  // 5. Repeat Question (Speaks Question aloud again)
  const handleRepeatQuestion = () => {
    if (!currentQ) return;
    if (isListening) {
      stopListening();
    }
    setVoiceStatus("AI_SPEAKING");
    const qNative = currentQ.voice_prompt || currentQ.question;
    const qFallback = currentQ.voice_prompt_en || currentQ.question_en || currentQ.question;
    speakQuestion(
      qNative,
      language,
      {
        onStart: () => {
          setVoiceStatus("AI_SPEAKING");
        },
        onEnd: () => {
          setVoiceStatus("YOUR_TURN");
        },
        onError: () => {
          setVoiceStatus("YOUR_TURN");
        }
      },
      qFallback
    );
  };

  // 6. Record Again (Clears current transcript and restarts microphone)
  const handleRecordAgain = () => {
    setCurrentTranscript("");
    startListening();
  };

  // 7. Submit Answer -> Call Backend AI Evaluation
  const handleSubmitAnswer = async () => {
    if (!currentQ) return;
    stopListening();

    const answerToEval = currentTranscript.trim();
    if (!answerToEval) {
      setMicError(
        language === "ta" 
          ? "தயவுசெய்து உங்கள் பதிலை பேசவும் அல்லது கீழே உள்ள கட்டத்தில் தட்டச்சு செய்யவும்." 
          : "Please speak your answer or type it in the text area below."
      );
      return;
    }

    setVoiceStatus("EVALUATING");
    setMicError(null);

    let evalRes: EvaluationResult | null = null;
    try {
      evalRes = await api.assessment.evaluate({
        skill: selectedTrade,
        question: currentQ.question,
        selected_language: language,
        transcribed_answer: answerToEval,
        question_id: currentQ.id,
        question_number: currentIndex + 1
      });
    } catch (err: any) {
      console.warn("API evaluate notice, evaluating locally:", err);
    }

    // Local evaluation fallback if API fails or on Vercel
    if (!evalRes || typeof evalRes.score !== "number") {
      evalRes = evaluateAssessmentAnswer(
        selectedTrade,
        currentQ.id,
        currentQ.question,
        language,
        answerToEval
      );
    }

    setCurrentEvaluation(evalRes);
    setVoiceStatus("EVALUATED");

    // Save into answer dossier
    setAnswersDossier((prev) => ({
      ...prev,
      [currentIndex + 1]: {
        question_id: currentQ.id,
        question_number: currentIndex + 1,
        question: currentQ.question,
        transcribed_answer: answerToEval,
        score: evalRes!.score,
        AI_feedback: evalRes!.feedback,
        correctness: evalRes!.correctness,
        safety_awareness: evalRes!.safety_awareness
      }
    }));

    // Speak feedback aloud in the worker's selected language
    const spokenFeedback = language === "ta"
      ? `மதிப்பீடு: பத்து மதிப்பெண்களுக்கு ${evalRes.score} மதிப்பெண்கள். ${evalRes.feedback}`
      : `Evaluation: ${evalRes.score} out of 10 points. ${evalRes.feedback}`;
    const fallbackFeedback = `Evaluation score: ${evalRes.score} out of 10. ${evalRes.correctness}.`;
    
    speakQuestion(spokenFeedback, language, undefined, fallbackFeedback);
  };

  // 8. Next Question or Final Results
  const handleNextQuestion = async () => {
    stopListening();
    stopAllAudio();

    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentTranscript("");
      setCurrentEvaluation(null);
      setVoiceStatus("AI_SPEAKING");
      setMicError(null);
      lastSpokenQIndexRef.current = nextIdx;

      const nextQ = questions[nextIdx];
      const nextQNative = nextQ.voice_prompt || nextQ.question;
      const nextQFallback = nextQ.voice_prompt_en || nextQ.question_en || nextQ.question;
      setTimeout(() => {
        speakQuestion(
          nextQNative,
          language,
          {
            onStart: () => {
              setVoiceStatus("AI_SPEAKING");
            },
            onEnd: () => {
              setVoiceStatus("YOUR_TURN");
            },
            onError: () => {
              setVoiceStatus("YOUR_TURN");
            }
          },
          nextQFallback
        );
      }, 200);
    } else {
      // All 10 questions finished -> Calculate and Submit Final Dossier
      await handleFinalizeAssessment();
    }
  };

  // 9. Calculate Final Score & Submit to Cooperative Board
  const handleFinalizeAssessment = async () => {
    setIsSubmittingFinal(true);

    try {
      const allDossierItems: AnswerDossier[] = Object.values(answersDossier);
      let totalPts = 0;
      allDossierItems.forEach((item) => {
        totalPts += item.score;
      });

      const count = Math.max(1, questions.length);
      const avg = round(totalPts / count, 1);
      const pct = Math.round((totalPts / (count * 10)) * 100);
      const isPassed = pct >= 60;

      const calcResult = {
        total: Math.round(totalPts),
        average: avg,
        percentage: pct,
        passed: isPassed
      };
      setFinalScore(calcResult);

      const allTranscriptsText = allDossierItems
        .map((d) => `Q${d.question_number}: "${d.transcribed_answer}" (Score: ${d.score}/10)`)
        .join(" | ");

      // Submit to backend if available
      try {
        await api.assessment.submit({
          skill: selectedTrade,
          preferred_language: language,
          total_score: calcResult.total,
          average_score: calcResult.average,
          percentage: calcResult.percentage,
          passed: isPassed,
          transcribed_answers: allDossierItems,
          all_transcripts: allTranscriptsText,
          evaluation_summary: `${selectedTrade} AI Voice Assessment (${language.toUpperCase()}). Score: ${pct}%. Status: PENDING_APPROVAL.`
        });
      } catch (subErr) {
        console.warn("Backend submit notice:", subErr);
      }

      setStep("RESULTS");

      // Voice out final result
      setTimeout(() => {
        const finalAudio = language === "ta"
          ? isPassed
            ? `வாழ்த்துகள்! நீங்கள் நூற்றுக்கு ${pct} மதிப்பெண்கள் பெற்று தேர்ச்சி பெற்றுள்ளீர்கள். உங்கள் சுயவிவரம் கூட்டுறவு நிர்வாகக் குழுவின் சரிபார்ப்பிற்கு சமர்ப்பிக்கப்பட்டுள்ளது.`
            : `உங்கள் மதிப்பீட்டு மதிப்பெண் ${pct} சதவீதம். குறைந்தபட்சம் 60 சதவீதம் தேவை. மீண்டும் முயற்சி செய்யவும்.`
          : isPassed
            ? `Congratulations! You scored ${pct} percent and passed the practical assessment. Your dossier is now pending cooperative board review.`
            : `Your score is ${pct} percent. A minimum of 60 percent is required. Please re-attempt.`;
        const fallbackAudio = isPassed
          ? `Congratulations! You scored ${pct} percent and passed the skill assessment. Your profile is submitted for cooperative board verification.`
          : `Your score is ${pct} percent. Minimum 60 percent is required. Please re-attempt.`;
        speakQuestion(finalAudio, language, undefined, fallbackAudio);
      }, 300);
    } catch (e: any) {
      console.warn("Finalize assessment notice:", e);
      setStep("RESULTS");
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  function round(val: number, decimals: number) {
    return Number(Math.round(Number(val + "e" + decimals)) + "e-" + decimals);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                CoopConnect AI
              </span>
              <span className="text-xs font-semibold text-gray-400 uppercase">
                {language === "ta" ? "திறன் மதிப்பீடு" : "AI Skill Assessment"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              {language === "ta" ? "குரல்வழி தொழில் திறன் மதிப்பீடு" : "Voice-Based Worker Skill Assessment"}
            </h1>
          </div>

          <Link
            href="/worker/dashboard"
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            {language === "ta" ? "டாஷ்போர்டு" : "Dashboard"}
          </Link>
        </div>

        {/* ============================================================ */}
        {/* SCREEN 1: LANGUAGE & TRADE SELECTION */}
        {/* ============================================================ */}
        {step === "LANGUAGE_SELECT" && (
          <div className="space-y-6 pt-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                1. Choose your preferred language / உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                The AI voice assistant will ask questions and evaluate your spoken answers in this language.
              </p>
            </div>

            {/* Language Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {LANGUAGES.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      setTestVoiceSuccess(null);
                    }}
                    className={`p-4 rounded-xl border text-left transition flex flex-col justify-between h-24 ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs"
                        : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold">{lang.native}</span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{lang.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                        lang.code === "ta"
                          ? "bg-amber-100 text-amber-900 font-bold"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {lang.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* TEST VOICE FEATURE */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                  <Volume2 className="w-5 h-5 text-emerald-600" />
                  <span>
                    {language === "ta" ? "குரல் பரிசோதனை (Test Voice)" : "Test AI Voice & Audio"}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded-md border border-emerald-200">
                  {LANGUAGES.find((l) => l.code === language)?.native} ({LANGUAGES.find((l) => l.code === language)?.speechCode})
                </span>
              </div>

              <p className="text-xs text-gray-600">
                {language === "ta"
                  ? "தேர்வைத் தொடங்குவதற்கு முன், உங்கள் சாதனத்தின் ஸ்பீக்கர் மற்றும் AI குரல் சரியாக ஒலிக்கிறதா என்பதை சரிபார்க்க கீழே உள்ள பொத்தானை அழுத்தவும்."
                  : "Click below to test whether your device speakers and browser voice output are working properly."}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={isTestingVoice}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-2 ${
                    isTestingVoice
                      ? "bg-amber-500 text-white animate-pulse"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98"
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>
                    {isTestingVoice
                      ? (language === "ta" ? "🔊 குரல் ஒலிக்கிறது..." : "🔊 Playing Voice...")
                      : (language === "ta" ? "🔊 குரல் சோதிக்க (Test Voice)" : "🔊 Test Voice")}
                  </span>
                </button>

                {testVoiceSuccess === true && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-white px-3 py-2 rounded-xl border border-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {language === "ta"
                        ? "குரல் வெற்றிகரமாக சோதிக்கப்பட்டது! ஒலி தெளிவாக கேட்கிறது."
                        : "Voice test completed successfully! Audio is verified."}
                    </span>
                  </div>
                )}

                {testVoiceSuccess === false && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 px-3 py-2 rounded-xl border border-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>
                      {language === "ta"
                        ? "ஒலி கேட்கவில்லையெனில், சாதனத்தின் ஒலியளவை (Volume) அதிகரிக்கவும்."
                        : "No sound heard? Please increase device volume or check browser audio."}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Trade Category Selection */}
            <div className="space-y-2 pt-4 border-t border-gray-100">
              <label className="block text-sm font-bold text-gray-900">
                2. {language === "ta" ? "உங்கள் தொழில் வகையைத் தேர்ந்தெடுக்கவும்" : "Select Trade Category"}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {TRADES.map((trade) => {
                  const isSelected = selectedTrade === trade;
                  return (
                    <button
                      key={trade}
                      type="button"
                      onClick={() => setSelectedTrade(trade)}
                      className={`p-3 rounded-lg border text-xs font-semibold text-center transition ${
                        isSelected
                          ? "bg-indigo-50 border-indigo-600 text-indigo-950 font-bold ring-1 ring-indigo-500"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {trade}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Guidelines Card */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs text-gray-700">
              <div className="flex items-center gap-2 font-bold text-gray-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === "ta" ? "குரல்வழி தேர்வு செயல்முறை (10 கேள்விகள்):" : "Voice Assessment Flow (10 Questions):"}
                </span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>
                  {language === "ta" 
                    ? "தேர்வு தொடங்கியதும், AI உதவியாளர் கேள்வியை தமிழில் பேசும்."
                    : "Once started, the AI speaks each question aloud."}
                </li>
                <li>
                  {language === "ta"
                    ? "AI பேசி முடித்ததும் உங்கள் முறை வரும்; மைக் பொத்தானை அழுத்தி பேசலாம்."
                    : "When AI finishes speaking, status changes to 'Your turn — please answer.'"}
                </li>
                <li>
                  {language === "ta"
                    ? "எந்த நேரத்திலும் '🔊 கேள்வியை மீண்டும் கேட்க' பொத்தானை அழுத்தலாம்."
                    : "You can tap '🔊 Repeat Question' anytime to hear the question again."}
                </li>
                <li>
                  {language === "ta"
                    ? "டைப்பிங் செய்ய வேண்டிய அவசியமில்லை. 60% மதிப்பெண் பெற்று கூட்டுறவு நிர்வாக ஒப்புதலுக்கு அனுப்பப்படும்."
                    : "No typing required. Pass mark is 60%. Results forwarded to Cooperative Board."}
                </li>
              </ul>
            </div>

            {/* START TEST BUTTON */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartTest}
                disabled={isLoadingQuestions}
                className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2"
              >
                {isLoadingQuestions ? (
                  <span>{language === "ta" ? "கேள்விகள் தயாராகின்றன..." : "Preparing Questions..."}</span>
                ) : (
                  <>
                    <span>{language === "ta" ? "தேர்வைத் தொடங்கு (START ASSESSMENT) 🎙️" : "START ASSESSMENT 🎙️"}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SCREEN 2: VOICE ASSISTANT (CLEAN SECTION 13 DESIGN) */}
        {/* ============================================================ */}
        {step === "ASSESSMENT" && currentQ && (
          <div className="space-y-6 pt-2">
            
            {/* Top Bar: Trade | Language | Question X of 10 */}
            <div className="flex items-center justify-between text-xs font-bold border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-gray-900 uppercase font-extrabold">{selectedTrade}</span>
                <span className="text-gray-300">•</span>
                <span className="text-emerald-700">{LANGUAGES.find((l) => l.code === language)?.native}</span>
              </div>
              <span className="text-gray-500">
                {language === "ta" ? `கேள்வி ${currentIndex + 1} / ${questions.length}` : `Question ${currentIndex + 1} of ${questions.length}`}
              </span>
            </div>

            {/* Tamil Voice Unavailable Warning if applicable */}
            {tamilVoiceWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  Tamil voice pack is synthesizing via browser speech engine. For the richest native accent, ensure Google Speech / OS language pack is enabled.
                </span>
              </div>
            )}

            {/* Browser Unsupported STT Warning */}
            {!isSupported && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  {language === "ta"
                    ? "குரல் அறிதல் இந்த உலாவியில் ஆதரிக்கப்படவில்லை. Google Chrome உலாவியைப் பயன்படுத்தவும் அல்லது கீழே உங்கள் பதிலை நேரடியாக தட்டச்சு செய்யவும்."
                    : "Voice input is not available in this browser. Please use Chrome or type your answer manually."}
                </span>
              </div>
            )}

            {/* Mic Error Notice if permission denied / no speech */}
            {micError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{micError}</span>
              </div>
            )}

            {/* QUESTION DISPLAY & AI SPEAKING STATUS */}
            <div className="p-6 bg-white border border-gray-200 rounded-2xl space-y-4 shadow-2xs">
              
              {/* Speaking indicator and Repeat Question Button */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold">
                  {voiceStatus === "AI_SPEAKING" && (
                    <span className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-pulse">
                      <Volume2 className="w-4 h-4" />
                      <span>{language === "ta" ? "AI கேள்வி கேட்கிறது..." : "AI is speaking..."}</span>
                    </span>
                  )}

                  {voiceStatus === "YOUR_TURN" && (
                    <span className="text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-emerald-600" />
                      <span>{language === "ta" ? "உங்கள் முறை — பதிலளிக்கவும்." : "Your turn — please answer."}</span>
                    </span>
                  )}

                  {voiceStatus === "LISTENING" && (
                    <span className="text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1.5 animate-pulse">
                      <Mic className="w-4 h-4" />
                      <span>{language === "ta" ? "உங்கள் பதிலை கேட்கிறோம்..." : "Listening..."}</span>
                    </span>
                  )}

                  {voiceStatus === "ANSWER_DETECTED" && (
                    <span className="text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span>{language === "ta" ? "பதில் பெறப்பட்டது." : "Answer detected."}</span>
                    </span>
                  )}

                  {voiceStatus === "EVALUATING" && (
                    <span className="text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 flex items-center gap-1.5 animate-pulse">
                      <Sparkles className="w-4 h-4" />
                      <span>{language === "ta" ? "மதிப்பிடப்படுகிறது..." : "Evaluating..."}</span>
                    </span>
                  )}

                  {voiceStatus === "IDLE" && (
                    <span className="text-gray-400 uppercase tracking-wider text-[11px]">
                      {language === "ta" ? "செய்முறை வினா" : "Practical Question"}
                    </span>
                  )}
                </div>

                {/* Clearly Visible Repeat Question Button */}
                <button
                  type="button"
                  onClick={handleRepeatQuestion}
                  className="px-4 py-2 rounded-xl bg-white border-2 border-emerald-600 hover:bg-emerald-50 text-xs font-bold text-emerald-800 flex items-center gap-2 transition shadow-xs"
                >
                  <Volume2 className="w-4 h-4 text-emerald-700" />
                  <span>{language === "ta" ? "🔊 கேள்வியை மீண்டும் கேட்க" : "🔊 Repeat Question"}</span>
                </button>
              </div>

              {/* Question Text */}
              <p className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
                "{currentQ.question}"
              </p>
            </div>

            {/* MICROPHONE & CAPTURE SECTION */}
            <div className="p-6 bg-white border border-gray-200 rounded-2xl text-center space-y-4 shadow-2xs">
              
              {/* Big Tap to Answer Button */}
              <div>
                <button
                  type="button"
                  disabled={voiceStatus === "EVALUATING"}
                  onClick={() => {
                    if (voiceStatus === "AI_SPEAKING") {
                      // Interrupt AI and start listening immediately
                      if (typeof window !== "undefined" && "speechSynthesis" in window) {
                        try { window.speechSynthesis.cancel(); } catch (e) {}
                      }
                      setIsSpeaking(false);
                      startListening();
                      return;
                    }
                    if (isListening) {
                      stopListening();
                    } else {
                      startListening();
                    }
                  }}
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center mx-auto transition-all shadow-md active:scale-95 ${
                    isListening
                      ? "bg-red-600 text-white ring-8 ring-red-100 animate-pulse"
                      : voiceStatus === "AI_SPEAKING"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-200 animate-pulse"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-100"
                  }`}
                >
                  {isListening ? (
                    <>
                      <Square className="w-6 h-6 sm:w-8 sm:h-8 mb-0.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {language === "ta" ? "முடிந்தது" : "Stop"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-7 h-7 sm:w-9 sm:h-9 mb-0.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {language === "ta" ? "பேசுக" : "Answer"}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Status Message */}
              <div>
                {voiceStatus === "AI_SPEAKING" ? (
                  <p className="text-xs font-bold text-emerald-700 animate-pulse">
                    {language === "ta" ? "🔊 AI கேள்வி கேட்கிறது... (தட்டி பதிலளிக்கலாம்)" : "🔊 AI is speaking... (Tap to answer)"}
                  </p>
                ) : isListening ? (
                  <p className="text-sm font-bold text-red-600 animate-pulse">
                    {language === "ta" ? "🎙️ உங்கள் பதிலை கேட்கிறோம்... (Listening...)" : "🎙️ Listening to your answer..."}
                  </p>
                ) : voiceStatus === "ANSWER_DETECTED" ? (
                  <p className="text-xs font-bold text-emerald-700">
                    {language === "ta" ? "✅ பதில் பெறப்பட்டது. திருத்தலாம் அல்லது சமர்ப்பிக்கவும்." : "✅ Answer detected. Review, edit, or submit."}
                  </p>
                ) : (
                  <p className="text-xs font-bold text-emerald-700">
                    {language === "ta" ? "👉 உங்கள் முறை — பதிலளிக்கவும் (Tap to Answer)" : "👉 Your turn — please answer (Tap to Answer)"}
                  </p>
                )}
              </div>

              {/* Interactive Transcribed Answer Box */}
              <div className="text-left bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    {language === "ta" ? "உங்கள் பதில் (குரல் / எழுத்து):" : "Your Answer (Voice / Text):"}
                  </span>
                  {currentTranscript && (
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTranscript("");
                        setVoiceStatus("YOUR_TURN");
                      }}
                      className="text-[11px] text-gray-400 hover:text-gray-700 font-semibold"
                    >
                      {language === "ta" ? "அழிக்க" : "Clear"}
                    </button>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={currentTranscript}
                  onChange={(e) => {
                    setCurrentTranscript(e.target.value);
                    if (e.target.value.trim()) {
                      setVoiceStatus("ANSWER_DETECTED");
                    }
                  }}
                  placeholder={
                    language === "ta"
                      ? "மைக் பொத்தானை அழுத்தி பேசவும். நீங்கள் பேசுவது இங்கே தானாகத் தோன்றும்..."
                      : "Tap microphone to speak. Your spoken answer will appear here automatically..."
                  }
                  className="w-full bg-white p-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
                />
              </div>

              {/* Action Buttons: Record Again & Submit Answer */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRecordAgain}
                  disabled={voiceStatus === "EVALUATING"}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === "ta" ? "மீண்டும் பதிவு செய்யவும்" : "Record Again"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={voiceStatus === "EVALUATING" || !currentTranscript.trim()}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition"
                >
                  {voiceStatus === "EVALUATING" ? (
                    <span>{language === "ta" ? "மதிப்பிடப்படுகிறது..." : "Evaluating..."}</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{language === "ta" ? "பதிலைச் சமர்ப்பிக்கவும்" : "Submit Answer"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI EVALUATION FEEDBACK CARD */}
            {currentEvaluation && (
              <div className="p-5 bg-white border border-emerald-200 rounded-2xl space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      {language === "ta" ? "AI மதிப்பீட்டு கருத்து" : "AI Practical Evaluation"}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs border ${
                    currentEvaluation.score >= 6
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-amber-50 text-amber-800 border-amber-300"
                  }`}>
                    {currentEvaluation.score} / 10 Points
                  </span>
                </div>

                <p className="text-sm font-semibold text-gray-800">
                  {currentEvaluation.feedback}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-gray-50 rounded-lg">
                    <span className="font-bold text-gray-500 block text-[10px] uppercase">Safety Awareness:</span>
                    <span className="text-gray-800">{currentEvaluation.safety_awareness}</span>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg">
                    <span className="font-bold text-gray-500 block text-[10px] uppercase">Practical Knowledge:</span>
                    <span className="text-gray-800">{currentEvaluation.practical_knowledge}</span>
                  </div>
                </div>

                {currentEvaluation.notice && (
                  <p className="text-[11px] text-gray-400 italic pt-1">
                    *{currentEvaluation.notice}
                  </p>
                )}

                {/* NEXT QUESTION BUTTON */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    disabled={isSubmittingFinal}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
                  >
                    <span>
                      {currentIndex < questions.length - 1
                        ? (language === "ta" ? "அடுத்த கேள்வி (Next Question) ➡️" : "Next Question ➡️")
                        : (language === "ta" ? "தேர்வை முடிக்கவும் (Complete Assessment) ✅" : "Complete Assessment ✅")}
                    </span>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ============================================================ */}
        {/* SCREEN 3: FINAL SCORE & COOPERATIVE REVIEW GATE */}
        {/* ============================================================ */}
        {step === "RESULTS" && finalScore && (
          <div className="space-y-6 pt-2">
            <div className={`p-8 rounded-2xl border text-center space-y-4 shadow-sm ${
              finalScore.passed
                ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                : "bg-red-50/70 border-red-300 text-red-950"
            }`}>
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto shadow-xs">
                <Award className={`w-8 h-8 ${finalScore.passed ? "text-emerald-600" : "text-red-600"}`} />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {language === "ta" ? "திறன் மதிப்பீட்டு முடிவு" : "SKILL ASSESSMENT RESULT"}
                </span>
                <h2 className="text-3xl font-extrabold text-gray-900 mt-1">
                  {selectedTrade}
                </h2>
                <div className="text-4xl font-black text-gray-900 mt-2">
                  {finalScore.percentage}%
                </div>
                <p className="text-xs font-semibold text-gray-500 mt-1">
                  Total: {finalScore.total} / 100 • Average: {finalScore.average} / 10
                </p>
              </div>

              <div className="inline-block">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                  finalScore.passed
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-red-100 text-red-800 border-red-300"
                }`}>
                  {finalScore.passed ? "STATUS: PASSED" : "STATUS: RE-ASSESSMENT REQUIRED"}
                </span>
              </div>

              <p className="text-xs text-gray-600 max-w-lg mx-auto leading-relaxed pt-2">
                {finalScore.passed
                  ? (language === "ta"
                      ? "தேர்ச்சி பெற்றுள்ளீர்கள்! கூட்டுறவு விதிமுறைகளின்படி, இந்த மதிப்பீட்டு அறிக்கை கூட்டுறவு குழுவின் சரிபார்ப்புக்கு அனுப்பப்பட்டுள்ளது. குழு ஒப்புதல் அளித்தவுடன் வாடிக்கையாளர் வேலைகள் ஒதுக்கப்படும்."
                      : "Assessment passed! As part of cooperative federation governance, your full 10-question transcript and safety evaluation have been forwarded for Cooperative Review. Upon approval, your status changes to Verified Worker.")
                  : (language === "ta"
                      ? "மதிப்பெண் 60% விட குறைவாக உள்ளது. நடைமுறைகளை மறுபரிசீலனை செய்து மீண்டும் தேர்வெழுதவும்."
                      : "Score is below 60%. Please review trade safety standards and retake the assessment.")}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/worker/dashboard"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                >
                  {language === "ta" ? "தொழிலாளர் டாஷ்போர்டு" : "Worker Dashboard"}
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setStep("LANGUAGE_SELECT");
                    setFinalScore(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs transition"
                >
                  {language === "ta" ? "மீண்டும் தேர்வு எழுது" : "Retake Assessment"}
                </button>
              </div>
            </div>

            {/* 10-Question Transcript Breakdown */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
                {language === "ta" ? "10 கேள்விகளின் குரல் பதிவு மற்றும் மதிப்பீடு:" : "10-Question Voice Transcript & Evaluation Dossier:"}
              </h3>

              <div className="divide-y divide-gray-100 space-y-3">
                {questions.map((q, idx) => {
                  const item = answersDossier[idx + 1];
                  return (
                    <div key={idx} className="pt-3 space-y-1.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-gray-900">
                          {idx + 1}. {q.question}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-800 flex-shrink-0">
                          {item ? item.score : 0}/10 pts
                        </span>
                      </div>

                      {item?.transcribed_answer && (
                        <div className="text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <span className="font-bold text-gray-500 text-[10px] uppercase block">
                            {language === "ta" ? "குரல் பதில்:" : "Spoken Answer:"}
                          </span>
                          "{item.transcribed_answer}"
                        </div>
                      )}

                      {item?.AI_feedback && (
                        <p className="text-emerald-800 font-medium text-[11px]">
                          ✓ {item.AI_feedback}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function WorkerAssessmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-gray-700">Loading AI Voice Assessment...</p>
          </div>
        </div>
      }
    >
      <AssessmentContent />
    </Suspense>
  );
}
