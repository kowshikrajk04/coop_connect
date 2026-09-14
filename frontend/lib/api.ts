const API_BASE = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("coop_token");
  }
  return null;
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("coop_token", token);
  }
}

export function getUserRole(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("coop_role");
  }
  return null;
}

export function getUserName(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("coop_name");
  }
  return null;
}

export function setAuthData(token: string, role: string, name: string, userId: number) {
  if (typeof window !== "undefined") {
    localStorage.setItem("coop_token", token);
    localStorage.setItem("coop_role", role);
    localStorage.setItem("coop_name", name);
    localStorage.setItem("coop_user_id", String(userId));
  }
}

export function clearAuthData() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("coop_token");
    localStorage.removeItem("coop_role");
    localStorage.removeItem("coop_name");
    localStorage.removeItem("coop_user_id");
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.message || "An unexpected error occurred");
  }

  return data;
}

export const api = {
  auth: {
    login: (login_id: string, password: string) =>
      request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login_id, password }),
      }),
    register: (payload: any) =>
      request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    sendOtp: (mobile: string) =>
      request("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ mobile }),
      }),
    verifyOtp: (mobile: string, otp: string) =>
      request("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ mobile, otp }),
      }),
    me: () => request("/api/auth/me"),
  },
  customer: {
    getProfile: () => request("/api/customer/profile"),
    updateProfile: (data: any) =>
      request("/api/customer/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    getBookings: () => request("/api/customer/bookings"),
  },
  worker: {
    getProfile: () => request("/api/worker/profile"),
    updateSkills: (skills: any[]) =>
      request("/api/worker/skills", {
        method: "POST",
        body: JSON.stringify({ skills }),
      }),
    updateDocs: (docs: any) =>
      request("/api/worker/documents", {
        method: "POST",
        body: JSON.stringify(docs),
      }),
    getAssessmentQuestions: (skill: string, lang: string = "en") =>
      request(`/api/worker/assessment/questions?skill=${encodeURIComponent(skill)}&lang=${lang}`),
    evaluateAnswer: (payload: any) =>
      request("/api/worker/assessment/evaluate-answer", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    submitAssessment: (payload: any) =>
      request("/api/worker/assessment/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    toggleAvailability: () =>
      request("/api/worker/toggle-availability", { method: "POST" }),
    getJobs: () => request("/api/worker/jobs"),
    acceptJob: (bookingId: number) =>
      request(`/api/worker/jobs/${bookingId}/accept`, { method: "POST" }),
    rejectJob: (bookingId: number) =>
      request(`/api/worker/jobs/${bookingId}/reject`, { method: "POST" }),
    startJob: (bookingId: number) =>
      request(`/api/worker/jobs/${bookingId}/start`, { method: "POST" }),
    completeJob: (bookingId: number, data: any) =>
      request(`/api/worker/jobs/${bookingId}/complete`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getRoute: () => request("/api/worker/route-optimization"),
  },
  assessment: {
    getQuestions: (skill: string, lang: string = "ta") =>
      request(`/api/assessment/questions?skill=${encodeURIComponent(skill)}&lang=${lang}`),
    evaluate: (payload: any) =>
      request("/api/assessment/evaluate", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    submit: (payload: any) =>
      request("/api/assessment/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  cooperative: {
    getDashboard: () => request("/api/cooperative/dashboard"),
    getWorkers: (status: string = "ALL") =>
      request(`/api/cooperative/workers?status_filter=${status}`),
    getWorkerDetail: (id: number) => request(`/api/cooperative/workers/${id}`),
    verifyWorker: (id: number, action: string, reason?: string) =>
      request(`/api/cooperative/workers/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      }),
    getFairAllocation: () => request("/api/cooperative/fair-allocation"),
    getWelfare: () => request("/api/cooperative/welfare"),
    getSettings: () => request("/api/cooperative/settings"),
    updateSettings: (settings: any) =>
      request("/api/cooperative/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
  },
  bookings: {
    create: (bookingData: any) =>
      request("/api/bookings", {
        method: "POST",
        body: JSON.stringify(bookingData),
      }),
    getDetails: (id: number) => request(`/api/bookings/${id}`),
  },
  payments: {
    getBreakdown: (bookingId: number) =>
      request(`/api/payments/breakdown/${bookingId}`),
    pay: (bookingId: number, method: string = "UPI") =>
      request("/api/payments/pay", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId, payment_method: method }),
      }),
    getInvoice: (bookingId: number) =>
      request(`/api/payments/invoice/${bookingId}`),
    submitRating: (bookingId: number, stars: number, feedback?: string) =>
      request("/api/payments/rating", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId, stars, feedback }),
      }),
  },
  demandForecast: {
    getForecast: () => request("/api/demand-forecast"),
  },
  notifications: {
    getAll: () => request("/api/notifications"),
    markRead: (id: number) =>
      request(`/api/notifications/${id}/read`, { method: "POST" }),
  },
  demo: {
    seed: () => request("/api/demo/seed", { method: "POST" }),
    reset: () => request("/api/demo/reset", { method: "POST" }),
  },
};
