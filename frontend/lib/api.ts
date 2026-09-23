const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
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
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (err?.name === "TypeError" || String(err?.message || "").toLowerCase().includes("fetch")) {
      throw new Error(
        `Unable to reach the CoopConnect server at ${API_BASE}. Please ensure the backend is running.`
      );
    }
    throw err;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail ||
      data.message ||
      (response.statusText ? `Request failed (${response.status}: ${response.statusText})` : "Network request failed. Please check connection.")
    );
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
    loginOtp: (login_id: string, otp: string) =>
      request("/api/auth/login-otp", {
        method: "POST",
        body: JSON.stringify({ login_id, otp }),
      }),
    register: (payload: any) => {
      const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
      return request("/api/auth/register", {
        method: "POST",
        body: isFormData ? payload : JSON.stringify(payload),
      });
    },
    sendOtp: (target: string | { email?: string; mobile?: string; purpose?: string }) => {
      const body = typeof target === "string"
        ? (target.includes("@") ? { email: target } : { mobile: target, email: target })
        : target;
      return request("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    verifyOtp: (target: string | { email?: string; mobile?: string; purpose?: string }, otp: string) => {
      const body = typeof target === "string"
        ? (target.includes("@") ? { email: target, otp } : { mobile: target, otp })
        : { ...target, otp };
      return request("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
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
    updateDocs: (docs: any) => {
      const isFormData = typeof FormData !== "undefined" && docs instanceof FormData;
      return request("/api/worker/documents", {
        method: "POST",
        body: isFormData ? docs : JSON.stringify(docs),
      });
    },
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
    markOnTheWay: (bookingId: number) =>
      request(`/api/worker/jobs/${bookingId}/on_the_way`, { method: "POST" }),
    markArrived: (bookingId: number) =>
      request(`/api/worker/jobs/${bookingId}/arrived`, { method: "POST" }),
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
    reallocate: (id: number) => request(`/api/bookings/${id}/reallocate`, { method: "POST" }),
    cancel: (id: number) => request(`/api/bookings/${id}/cancel`, { method: "POST" }),
  },
  payments: {
    getBreakdown: (bookingId: number) =>
      request(`/api/payments/breakdown/${bookingId}`),
    createOrder: (bookingId: number, amount?: number) =>
      request("/api/payments/create-order", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId, amount }),
      }),
    verifyPayment: (payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      booking_id: number;
    }) =>
      request("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    pay: (bookingId: number, method: string = "UPI") =>
      request("/api/payments/pay", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId, payment_method: method }),
      }),
    getInvoice: (bookingId: number) =>
      request(`/api/payments/invoice/${bookingId}`),
    getQR: (bookingId: number) =>
      request(`/api/payments/qr/${bookingId}`, { method: "POST" }),
    submitRating: (bookingId: number, stars: number, feedback?: string) =>
      request("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId, rating: stars, feedback }),
      }),
  },
  feedback: {
    submit: (bookingId: number, rating: number, feedback?: string) =>
      request("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId, rating, feedback }),
      }),
    getWorkerFeedback: (workerId: number, page: number = 1, pageSize: number = 20) =>
      request(`/api/workers/${workerId}/feedback?page=${page}&page_size=${pageSize}`),
    getWorkerPerformance: (workerId: number) =>
      request(`/api/workers/${workerId}/performance`),
  },
  leaderboard: {
    get: (params?: { trade?: string; cooperative_id?: number; time_period?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.trade && params.trade !== "ALL") q.append("trade", params.trade);
      if (params?.cooperative_id) q.append("cooperative_id", String(params.cooperative_id));
      if (params?.time_period) q.append("time_period", params.time_period);
      if (params?.limit) q.append("limit", String(params.limit));
      const qs = q.toString();
      return request(`/api/leaderboard${qs ? `?${qs}` : ""}`);
    },
  },
  demandForecast: {
    getForecast: () => request("/api/demand-forecast"),
  },
  notifications: {
    getAll: () => request("/api/notifications"),
    markRead: (id: number) =>
      request(`/api/notifications/${id}/read`, { method: "POST" }),
  },
  complaints: {
    raise: (bookingId: number, category: string, description: string) =>
      request("/api/complaints", {
        method: "POST",
        body: JSON.stringify({ booking_id: bookingId, category, description }),
      }),
    getMy: () => request("/api/complaints/my"),
    getCooperative: (status: string = "ALL") =>
      request(`/api/complaints/cooperative?status_filter=${status}`),
    resolve: (complaintId: number, resolution: string, status: string = "RESOLVED") =>
      request(`/api/complaints/${complaintId}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ resolution, status }),
      }),
  },
  memberships: {
    getCooperatives: () => request("/api/memberships/cooperatives"),
    requestJoin: (payload: { cooperative_id: number; membership_type?: string; notes?: string }) =>
      request("/api/memberships/request", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getMyStatus: () => request("/api/memberships/my-status"),
    getCooperativeRequests: (status: string = "ALL") =>
      request(`/api/memberships/cooperative-requests?status_filter=${status}`),
    approve: (requestId: number) =>
      request(`/api/memberships/requests/${requestId}/approve`, {
        method: "POST",
      }),
    reject: (requestId: number, reason?: string) =>
      request(`/api/memberships/requests/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
  },
};
