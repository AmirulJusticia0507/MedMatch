export type HospitalTypeValue = number | string;

export interface HospitalRecommendation {
  hospitalId: string;
  hospitalName: string;
  distanceKm: number;
  estimatedTravelMinutes: number;
  currentQueueCount: number;
  estimatedWaitMinutes: number;
  availableBeds: number;
  bedClass: string;
  recommendationScore: number;
  specialtyCode: string;
  specialtyName: string;
  hospitalType: HospitalTypeValue;
  address: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  lastUpdated?: string;
}

export interface SpecialtyOption {
  code: string;
  name: string;
  category?: number | string;
}

export interface RecommendationFilters {
  latitude: number;
  longitude: number;
  specialtyCode: string;
  bedClass: string;
  maxDistanceKm: number;
  maxResults: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  success: boolean;
  reply: string;
  model: string;
  error?: string | null;
  promptTokens: number;
  completionTokens: number;
}

export interface ApiErrorPayload {
  error?: string;
  title?: string;
  detail?: string;
}

export type DataSource = "live" | "demo";
