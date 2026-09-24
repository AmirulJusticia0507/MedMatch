import type { ChatMessage, HospitalRecommendation, SpecialtyOption } from "../types";

export const specialtyOptions: SpecialtyOption[] = [
  { code: "CARDIOLOGY", name: "Jantung" },
  { code: "PULMONOLOGY", name: "Paru-paru" },
  { code: "NEUROLOGY", name: "Syaraf" },
  { code: "ORTHOPEDICS", name: "Bedah ortopedi" },
  { code: "PEDIATRICS", name: "Anak-anak" },
  { code: "INTERNAL_MEDICINE", name: "Penyakit dalam" },
  { code: "OBSTETRICS_GYNECOLOGY", name: "Kandungan" },
  { code: "DERMATOLOGY", name: "Kulit" }
];

export const bedClassOptions = [
  { value: "KELAS_1", label: "Kelas 1" },
  { value: "KELAS_2", label: "Kelas 2" },
  { value: "KELAS_3", label: "Kelas 3" },
  { value: "ICU", label: "ICU" },
  { value: "NICU", label: "NICU" },
  { value: "PICU", label: "PICU" },
  { value: "VIP", label: "VIP" }
];

export const mockRecommendations: HospitalRecommendation[] = [
  {
    hospitalId: "RSUP-CIPTO-001",
    hospitalName: "RSUP Dr. Cipto Mangunkusumo",
    distanceKm: 2.8,
    estimatedTravelMinutes: 14,
    currentQueueCount: 8,
    estimatedWaitMinutes: 18,
    availableBeds: 12,
    bedClass: "KELAS_1",
    recommendationScore: 94.8,
    specialtyCode: "CARDIOLOGY",
    specialtyName: "Jantung",
    hospitalType: 1,
    address: "Jl. Diponegoro No. 5, Jakarta Pusat",
    phone: "+62 21 422 1121",
    latitude: -6.1754,
    longitude: 106.8272,
    lastUpdated: "2025-06-24T08:42:00Z"
  },
  {
    hospitalId: "RSPAD-GS-002",
    hospitalName: "RSPAD Gatot Soebroto",
    distanceKm: 4.6,
    estimatedTravelMinutes: 21,
    currentQueueCount: 5,
    estimatedWaitMinutes: 12,
    availableBeds: 8,
    bedClass: "KELAS_1",
    recommendationScore: 91.2,
    specialtyCode: "CARDIOLOGY",
    specialtyName: "Jantung",
    hospitalType: 1,
    address: "Jl. Jenderal Sudirman No. 1, Jakarta Pusat",
    phone: "+62 21 8093 5008",
    latitude: -6.1908,
    longitude: 106.8173,
    lastUpdated: "2025-06-24T08:40:00Z"
  },
  {
    hospitalId: "RS-HARAPAN-003",
    hospitalName: "RS Harapan Kita",
    distanceKm: 7.2,
    estimatedTravelMinutes: 27,
    currentQueueCount: 11,
    estimatedWaitMinutes: 24,
    availableBeds: 16,
    bedClass: "KELAS_1",
    recommendationScore: 86.7,
    specialtyCode: "CARDIOLOGY",
    specialtyName: "Jantung",
    hospitalType: 2,
    address: "Jl. Raya Jatinegara No. 1, Jakarta Timur",
    phone: "+62 21 8090 5200",
    latitude: -6.1892,
    longitude: 106.8639,
    lastUpdated: "2025-06-24T08:35:00Z"
  },
  {
    hospitalId: "RS-BHAYANGKARA-004",
    hospitalName: "RS Bhayangkara Pusat Kesehatan",
    distanceKm: 9.8,
    estimatedTravelMinutes: 34,
    currentQueueCount: 7,
    estimatedWaitMinutes: 16,
    availableBeds: 6,
    bedClass: "KELAS_1",
    recommendationScore: 82.4,
    specialtyCode: "CARDIOLOGY",
    specialtyName: "Jantung",
    hospitalType: 1,
    address: "Jl. Jenderal Sudirman No. 1, Jakarta Pusat",
    phone: "+62 21 8093 5008",
    latitude: -6.2142,
    longitude: 106.8354,
    lastUpdated: "2025-06-24T08:30:00Z"
  },
  {
    hospitalId: "RS-UKD-005",
    hospitalName: "RS Unified Dadi Poetra",
    distanceKm: 12.4,
    estimatedTravelMinutes: 41,
    currentQueueCount: 14,
    estimatedWaitMinutes: 29,
    availableBeds: 4,
    bedClass: "KELAS_1",
    recommendationScore: 76.9,
    specialtyCode: "CARDIOLOGY",
    specialtyName: "Jantung",
    hospitalType: 1,
    address: "Jl. Raya Lebak Bulus No. 1, Jakarta Selatan",
    phone: "+62 21 280 8888",
    latitude: -6.2402,
    longitude: 106.8927,
    lastUpdated: "2025-06-24T08:25:00Z"
  }
];

export const initialChatMessages: ChatMessage[] = [
  {
    role: "assistant",
    content: "Halo, saya MedMatch. Ceritakan kebutuhan pasien dan saya akan membantu mencari pilihan rujukan terbaik."
  }
];

export const mockCapacitySummary = [
  { label: "Tersedia", value: 46, color: "#56b49b" },
  { label: "Terisi", value: 31, color: "#f3b75a" },
  { label: "Kosong", value: 23, color: "#e5ebe5" }
];
