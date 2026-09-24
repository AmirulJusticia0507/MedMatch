import type {
  ApiErrorPayload,
  AuthResponse,
  ChatMessage,
  ChatResponse,
  ForgotPasswordResponse,
  HospitalRecommendation,
  RecommendationFilters,
  SpecialtyOption
} from "../types";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new ApiError("Tidak dapat terhubung ke MedMatch API.", 0);
  }

  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      body = rawBody;
    }
  }

  if (!response.ok) {
    const errorBody = body as ApiErrorPayload | null;
    const message = errorBody?.error ?? errorBody?.detail ?? "Permintaan API gagal diproses.";
    throw new ApiError(message, response.status);
  }

  return body as T;
}

function normalizeRecommendation(value: HospitalRecommendation): HospitalRecommendation {
  return {
    ...value,
    distanceKm: Number(value.distanceKm ?? 0),
    estimatedTravelMinutes: Number(value.estimatedTravelMinutes ?? 0),
    currentQueueCount: Number(value.currentQueueCount ?? 0),
    estimatedWaitMinutes: Number(value.estimatedWaitMinutes ?? 0),
    availableBeds: Number(value.availableBeds ?? 0),
    recommendationScore: Number(value.recommendationScore ?? 0),
    hospitalId: value.hospitalId ?? "",
    hospitalName: value.hospitalName ?? "Fasilitas kesehatan",
    address: value.address ?? "Alamat belum tersedia",
    phone: value.phone ?? "-"
  };
}

export const medmatchApi = {
  signUp(email: string, password: string, fullName: string): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName })
    });
  },

  login(email: string, password: string): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return request<ForgotPasswordResponse>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },

  resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword })
    });
  },

  async getRecommendations(filters: RecommendationFilters, signal?: AbortSignal): Promise<HospitalRecommendation[]> {
    const params = new URLSearchParams({
      latitude: String(filters.latitude),
      longitude: String(filters.longitude),
      specialtyCode: filters.specialtyCode,
      bedClass: filters.bedClass,
      maxDistanceKm: String(filters.maxDistanceKm),
      maxResults: String(filters.maxResults)
    });

    const result = await request<HospitalRecommendation[]>(`/api/recommendations?${params.toString()}`, { signal });
    return Array.isArray(result) ? result.map(normalizeRecommendation) : [];
  },

  async getSpecialties(signal?: AbortSignal): Promise<SpecialtyOption[]> {
    const result = await request<SpecialtyOption[]>("/api/specialties", { signal });
    return Array.isArray(result) ? result : [];
  },

  async getChatHealth(signal?: AbortSignal): Promise<boolean> {
    try {
      const result = await request<{ status: string }>("/api/chat/health", { signal });
      return result.status.toLowerCase() === "ok";
    } catch {
      return false;
    }
  },

  async sendChat(message: string, history: ChatMessage[], signal?: AbortSignal): Promise<ChatResponse> {
    return request<ChatResponse>("/api/chat", {
      method: "POST",
      signal,
      body: JSON.stringify({
        message,
        systemPrompt: "Kamu adalah asisten kesehatan MedMatch. Berikan informasi yang ringkas, aman, dan arahkan pasien ke tenaga profesional untuk diagnosis atau kondisi darurat.",
        history
      })
    });
  }
};
