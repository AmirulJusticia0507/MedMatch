import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  BedDouble,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cross,
  Filter,
  Info,
  LayoutDashboard,
  LocateFixed,
  MapPin,
  Menu,
  MoreHorizontal,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  UserRound,
  X,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { medmatchApi } from "./api/medmatch";
import {
  bedClassOptions,
  initialChatMessages,
  mockRecommendations,
  specialtyOptions
} from "./data/mockData";
import type {
  ChatMessage,
  DataSource,
  HospitalRecommendation,
  RecommendationFilters,
  SpecialtyOption
} from "./types";

type ViewId = "overview" | "recommendations" | "facilities" | "assistant";

type FilterKey = "specialtyCode" | "bedClass";

interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface RecommendationCardProps {
  hospital: HospitalRecommendation;
  rank: number;
  selected: boolean;
  onSelect: (hospital: HospitalRecommendation) => void;
}

interface CapacityMapProps {
  recommendations: HospitalRecommendation[];
  selectedHospitalId: string | null;
  onSelect: (hospital: HospitalRecommendation) => void;
}

interface FacilitiesTableProps {
  recommendations: HospitalRecommendation[];
  onSelect: (hospital: HospitalRecommendation) => void;
}

interface SearchHeroProps {
  filters: RecommendationFilters;
  specialties: SpecialtyOption[];
  locationLabel: string;
  isRefreshing: boolean;
  isLocating: boolean;
  dataSource: DataSource;
  notice: string;
  noticeVisible: boolean;
  onFilterChange: (key: FilterKey, value: string) => void;
  onLocationChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLocate: () => void;
  onQuickSearch: (code: string) => void;
  onDismissNotice: () => void;
}

interface ChatComposerProps {
  value: string;
  isLoading: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  online: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const defaultFilters: RecommendationFilters = {
  latitude: -6.2088,
  longitude: 106.8456,
  specialtyCode: "CARDIOLOGY",
  bedClass: "KELAS_1",
  maxDistanceKm: 25,
  maxResults: 5
};

const navItems: NavItem[] = [
  { id: "overview", label: "Ringkasan", icon: LayoutDashboard },
  { id: "recommendations", label: "Rekomendasi", icon: Sparkles, badge: "5" },
  { id: "facilities", label: "Fasilitas", icon: Building2 },
  { id: "assistant", label: "Asisten AI", icon: Bot, badge: "AI" }
];

const viewTitles: Record<ViewId, string> = {
  overview: "Ringkasan",
  recommendations: "Rekomendasi",
  facilities: "Fasilitas",
  assistant: "Asisten AI"
};

const hospitalTypeLabels: Record<number, string> = {
  1: "Rumah Sakit Umum",
  2: "Rumah Sakit Khusus",
  3: "Rumah Sakit Jiwa",
  4: "Puskesmas",
  5: "Klinik Pratama",
  6: "Klinik Utama"
};

const mapMarkerPositions = [
  { x: 48, y: 48 },
  { x: 35, y: 35 },
  { x: 68, y: 64 },
  { x: 27, y: 69 },
  { x: 76, y: 31 }
];

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getSpecialtyName(code: string, specialties: SpecialtyOption[]): string {
  return specialties.find((specialty) => specialty.code === code)?.name ?? "Spesialis";
}

function getMockResults(filters: RecommendationFilters): HospitalRecommendation[] {
  return mockRecommendations.map((hospital, index) => ({
    ...hospital,
    specialtyCode: filters.specialtyCode,
    specialtyName: getSpecialtyName(filters.specialtyCode, specialtyOptions),
    bedClass: filters.bedClass,
    availableBeds: Math.max(1, hospital.availableBeds + (filters.bedClass === "ICU" ? -3 : 1)),
    recommendationScore: Math.max(68, Number((hospital.recommendationScore - index * 1.7).toFixed(1)))
  }));
}

function getQueueLabel(queue: number): string {
  if (queue <= 5) return "Antrian ringan";
  if (queue <= 15) return "Normal";
  return "Sedang padat";
}

function getQueueClass(queue: number): string {
  if (queue <= 5) return "queue-good";
  if (queue <= 15) return "queue-normal";
  return "queue-busy";
}

function formatDistance(distance: number): string {
  return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1).replace(".0", "")} km`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatToday(): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function fallbackChatReply(message: string): string {
  if (/emergency|darurat|nyeri dada|sesak|tidak bisa bernapas/i.test(message)) {
    return "Jika pasien mengalami darurat seperti nyeri dada berat, sesak napas, atau kehilangan kesadaran, segera hubungi 119 atau layanan gawat darurat terdekat. MedMatch tidak menggantikan pemeriksaan tenaga kesehatan.";
  }

  return "Saya bisa membantu merangkum pilihan fasilitas. Untuk hasil yang lebih akurat, isi lokasi, spesialisasi, dan kelas perawatan pada pencarian MedMatch.";
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-label="MedMatch">
      <span className="brand-mark__symbol">
        <Cross size={20} strokeWidth={2.8} />
      </span>
      <span className="brand-mark__text">
        medmatch
        <small>smart referral</small>
      </span>
    </div>
  );
}

function Sidebar({
  activeView,
  isOpen,
  onNavigate,
  onClose
}: {
  activeView: ViewId;
  isOpen: boolean;
  onNavigate: (view: ViewId) => void;
  onClose: () => void;
}) {
  return (
    <aside className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
      <div className="sidebar__header">
        <BrandMark />
        <button className="icon-button sidebar__close" onClick={onClose} aria-label="Tutup menu">
          <X size={19} />
        </button>
      </div>

      <div className="sidebar__profile">
        <div className="avatar avatar--light">AR</div>
        <div>
          <strong>Andi Ronaldo</strong>
          <span>Patient workspace</span>
        </div>
        <ChevronDown size={15} />
      </div>

      <div className="sidebar__section-label">Workspace</div>
      <nav className="sidebar__nav" aria-label="Navigasi utama">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              className={`sidebar__nav-item ${isActive ? "is-active" : ""}`}
              key={item.id}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} strokeWidth={isActive ? 2.4 : 1.9} />
              <span>{item.label}</span>
              {item.badge ? <em>{item.badge}</em> : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__section-label sidebar__section-label--secondary">Pengaturan</div>
      <nav className="sidebar__nav" aria-label="Pengaturan">
        <button className="sidebar__nav-item" onClick={() => onNavigate("facilities")}>
          <Settings size={18} />
          <span>Preferensi</span>
        </button>
        <button className="sidebar__nav-item" onClick={() => onNavigate("assistant")}>
          <CircleHelp size={18} />
          <span>Pusat bantuan</span>
        </button>
      </nav>

      <div className="sidebar__spacer" />
      <div className="sidebar__help">
        <span className="sidebar__help-icon">
          <ShieldCheck size={17} />
        </span>
        <strong>Data Anda aman</strong>
        <p>Terhubung ke sistem kesehatan nasional.</p>
        <button onClick={() => onNavigate("assistant")}>
          Pelajari selengkapnya <ArrowRight size={14} />
        </button>
      </div>
      <div className="sidebar__footer">
        <span className="status-dot status-dot--light" />
        <span>Terakhir diperbarui 2 menit lalu</span>
      </div>
    </aside>
  );
}

function Topbar({
  title,
  dataSource,
  isRefreshing,
  onMenu,
  onRefresh
}: {
  title: string;
  dataSource: DataSource;
  isRefreshing: boolean;
  onMenu: () => void;
  onRefresh: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="icon-button topbar__menu" onClick={onMenu} aria-label="Buka menu">
          <Menu size={21} />
        </button>
        <div className="breadcrumb">
          <span>MedMatch</span>
          <ChevronRight size={14} />
          <strong>{title}</strong>
        </div>
      </div>
      <div className="topbar__right">
        <div className={`source-status source-status--${dataSource}`}>
          <span className="status-dot" />
          {dataSource === "live" ? "Data live" : "Mode demo"}
        </div>
        <button className="topbar__date" onClick={onRefresh} title="Muat ulang data">
          <CalendarDays size={16} />
          <span>{formatToday()}</span>
          <RefreshCw size={14} className={isRefreshing ? "is-spinning" : ""} />
        </button>
        <button className="icon-button notification-button" aria-label="Notifikasi">
          <Bell size={19} />
          <span />
        </button>
        <div className="avatar avatar--dark">AR</div>
      </div>
    </header>
  );
}

function SearchHero({
  filters,
  specialties,
  locationLabel,
  isRefreshing,
  isLocating,
  dataSource,
  notice,
  noticeVisible,
  onFilterChange,
  onLocationChange,
  onSubmit,
  onLocate,
  onQuickSearch,
  onDismissNotice
}: SearchHeroProps) {
  return (
    <section className="hero-panel">
      <div className="hero-panel__glow hero-panel__glow--one" />
      <div className="hero-panel__glow hero-panel__glow--two" />
      <div className="hero-panel__content">
        <div className="hero-panel__intro">
          <div className="eyebrow eyebrow--light">
            <span className="eyebrow__dot" />
            Pencarian cerdas
          </div>
          <h1>Temukan fasilitas yang<br className="desktop-only" /> paling tepat untuk pasien.</h1>
          <p>MedMatch membandingkan jarak, antrean, dan ketersediaan tempat tidur dalam satu pencarian.</p>
        </div>
        <div className="hero-panel__side-note">
          <span className="hero-panel__side-icon">
            <Activity size={19} />
          </span>
          <div>
            <strong>Matching engine aktif</strong>
            <span>Data diperbarui setiap 3–5 menit</span>
          </div>
        </div>
      </div>

      <form className="search-form" onSubmit={onSubmit}>
        <label className="search-field">
          <span className="search-field__label">Spesialisasi</span>
          <span className="search-field__control">
            <Stethoscope size={17} />
            <select value={filters.specialtyCode} onChange={(event) => onFilterChange("specialtyCode", event.target.value)}>
              {specialties.map((specialty) => (
                <option key={specialty.code} value={specialty.code}>
                  {specialty.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>
        <label className="search-field">
          <span className="search-field__label">Kelas perawatan</span>
          <span className="search-field__control">
            <BedDouble size={17} />
            <select value={filters.bedClass} onChange={(event) => onFilterChange("bedClass", event.target.value)}>
              {bedClassOptions.map((bedClass) => (
                <option key={bedClass.value} value={bedClass.value}>
                  {bedClass.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>
        <label className="search-field search-field--location">
          <span className="search-field__label">Lokasi pasien</span>
          <span className="search-field__control">
            <MapPin size={17} />
            <input value={locationLabel} onChange={(event) => onLocationChange(event.target.value)} aria-label="Lokasi pasien" />
            <button type="button" className="locate-button" onClick={onLocate} aria-label="Gunakan lokasi saat ini">
              {isLocating ? <RefreshCw size={16} className="is-spinning" /> : <LocateFixed size={16} />}
            </button>
          </span>
        </label>
        <button className="search-submit" type="submit" disabled={isRefreshing}>
          {isRefreshing ? <RefreshCw size={18} className="is-spinning" /> : <Search size={18} />}
          <span>{isRefreshing ? "Mencari" : "Cari fasilitas"}</span>
        </button>
      </form>

      <div className="hero-panel__footer">
        <div className="quick-searches">
          <span>Coba cepat:</span>
          {[
            { code: "CARDIOLOGY", label: "Jantung" },
            { code: "PULMONOLOGY", label: "Paru-paru" },
            { code: "PEDIATRICS", label: "Anak-anak" }
          ].map((item) => (
            <button key={item.code} type="button" onClick={() => onQuickSearch(item.code)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="hero-panel__verified">
          <Check size={14} />
          <span>{dataSource === "live" ? "Terhubung ke data MedMatch" : "Pratinjau dengan data simulasi"}</span>
        </div>
      </div>

      {noticeVisible ? (
        <div className="connection-notice">
          <Info size={15} />
          <span>{notice}</span>
          <button type="button" onClick={onDismissNotice} aria-label="Tutup pemberitahuan">
            <X size={14} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  trend
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "mint" | "yellow" | "blue" | "coral";
  trend?: string;
}) {
  return (
    <article className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${tone}`}>
        <Icon size={19} />
      </div>
      <div className="metric-card__body">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>
          {trend ? <b>{trend}</b> : null}
          {detail}
        </small>
      </div>
      <button className="metric-card__more" aria-label={`Opsi ${label}`}>
        <MoreHorizontal size={17} />
      </button>
    </article>
  );
}

function RecommendationCard({ hospital, rank, selected, onSelect }: RecommendationCardProps) {
  const queueClass = getQueueClass(hospital.currentQueueCount);
  const typeLabel = typeof hospital.hospitalType === "number" ? hospitalTypeLabels[hospital.hospitalType] : hospital.hospitalType;

  return (
    <article className={`recommendation-card ${selected ? "is-selected" : ""}`}>
      <div className="recommendation-card__topline">
        <span className="rank-badge">#{rank}</span>
        <span className="match-score">
          <strong>{Math.round(hospital.recommendationScore)}%</strong>
          <small>cocok</small>
        </span>
      </div>
      <div className="recommendation-card__identity">
        <div className="hospital-symbol">
          <Cross size={19} />
        </div>
        <div>
          <h3>{hospital.hospitalName}</h3>
          <p>
            {typeLabel ?? "Fasilitas kesehatan"} <span>•</span> {hospital.specialtyName}
          </p>
        </div>
      </div>
      <div className="recommendation-card__address">
        <MapPin size={14} />
        <span>{hospital.address}</span>
      </div>
      <div className="recommendation-card__metrics">
        <div>
          <Navigation size={14} />
          <span><strong>{hospital.estimatedTravelMinutes} mnt</strong><small>perjalanan</small></span>
        </div>
        <div>
          <Clock3 size={14} />
          <span><strong>{hospital.estimatedWaitMinutes} mnt</strong><small>estimasi tunggu</small></span>
        </div>
        <div>
          <BedDouble size={14} />
          <span><strong>{hospital.availableBeds} bed</strong><small>{hospital.bedClass.replace("KELAS_", "Kelas ").toLowerCase()}</small></span>
        </div>
      </div>
      <div className="recommendation-card__bottom">
        <span className={`queue-pill ${queueClass}`}>
          <span className="status-dot" />
          {getQueueLabel(hospital.currentQueueCount)} · {hospital.currentQueueCount} orang
        </span>
        <button className="text-button" onClick={() => onSelect(hospital)}>
          Detail <ArrowRight size={14} />
        </button>
      </div>
    </article>
  );
}

function CapacityMap({ recommendations, selectedHospitalId, onSelect }: CapacityMapProps) {
  const visibleHospitals = recommendations.slice(0, 5);
  const availableBeds = recommendations.reduce((total, hospital) => total + hospital.availableBeds, 0);
  const averageQueue = recommendations.length
    ? Math.round(recommendations.reduce((total, hospital) => total + hospital.currentQueueCount, 0) / recommendations.length)
    : 0;

  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-heading__eyebrow">Live overview</span>
          <h2>Ketersediaan di sekitar</h2>
        </div>
        <button className="panel-heading__action" aria-label="Filter peta">
          <SlidersHorizontal size={16} />
        </button>
      </div>
      <div className="map-canvas">
        <svg className="map-lines" viewBox="0 0 500 340" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(18,60,58,.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="500" height="340" fill="url(#map-grid)" />
          <path d="M-20 278 C65 245 87 198 145 210 S226 284 291 236 S367 121 526 143" fill="none" stroke="rgba(18,60,58,.12)" strokeWidth="18" />
          <path d="M-20 278 C65 245 87 198 145 210 S226 284 291 236 S367 121 526 143" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth="11" />
          <path d="M42 14 C89 70 129 89 161 139 S190 244 257 333" fill="none" stroke="rgba(18,60,58,.08)" strokeWidth="9" />
          <path d="M42 14 C89 70 129 89 161 139 S190 244 257 333" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="4" />
          <path d="M340 -10 C300 54 303 88 354 125 S425 177 476 332" fill="none" stroke="rgba(18,60,58,.08)" strokeWidth="7" />
          <path d="M340 -10 C300 54 303 88 354 125 S425 177 476 332" fill="none" stroke="rgba(255,255,255,.74)" strokeWidth="3" />
          <path d="M0 101 C104 117 135 112 210 74 S340 28 510 65" fill="none" stroke="rgba(18,60,58,.07)" strokeWidth="5" />
          <path d="M0 101 C104 117 135 112 210 74 S340 28 510 65" fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="2" />
          <circle cx="145" cy="210" r="27" fill="rgba(86,180,155,.12)" />
          <circle cx="145" cy="210" r="8" fill="rgba(86,180,155,.22)" />
        </svg>
        <span className="map-label map-label--north">JAKARTA PUSAT</span>
        <span className="map-label map-label--south">JAKARTA SELATAN</span>
        <span className="map-label map-label--east">JAKARTA TIMUR</span>
        <span className="map-you"><span /> Lokasi Anda</span>
        {visibleHospitals.map((hospital, index) => {
          const position = mapMarkerPositions[index];
          return (
            <button
              className={`map-marker ${selectedHospitalId === hospital.hospitalId ? "is-active" : ""}`}
              key={hospital.hospitalId}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              onClick={() => onSelect(hospital)}
              aria-label={`Lihat ${hospital.hospitalName}`}
            >
              <span>{index + 1}</span>
            </button>
          );
        })}
        <div className="map-legend">
          <span><i className="map-legend__dot map-legend__dot--available" /> Tersedia</span>
          <span><i className="map-legend__dot map-legend__dot--busy" /> Antrian tinggi</span>
        </div>
      </div>
      <div className="map-summary">
        <div>
          <span className="map-summary__icon map-summary__icon--mint"><BedDouble size={16} /></span>
          <span><strong>{formatNumber(availableBeds)}</strong><small>bed tersedia</small></span>
        </div>
        <div>
          <span className="map-summary__icon map-summary__icon--yellow"><Clock3 size={16} /></span>
          <span><strong>{averageQueue}</strong><small>antrean rata-rata</small></span>
        </div>
        <div className="map-summary__updated"><span className="status-dot" /> Update 2 menit lalu</div>
      </div>
    </section>
  );
}

function FacilitiesTable({ recommendations, onSelect }: FacilitiesTableProps) {
  return (
    <section className="panel facilities-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-heading__eyebrow">Around you</span>
          <h2>Fasilitas terdekat</h2>
        </div>
        <button className="panel-heading__link" onClick={() => onSelect(recommendations[0])}>
          Lihat semua <ArrowRight size={14} />
        </button>
      </div>
      <div className="table-wrap">
        <table className="facility-table">
          <thead>
            <tr>
              <th>Fasilitas</th>
              <th>Jarak</th>
              <th>Antrean</th>
              <th>Bed</th>
              <th>Status</th>
              <th aria-label="Aksi" />
            </tr>
          </thead>
          <tbody>
            {recommendations.slice(0, 4).map((hospital) => (
              <tr key={hospital.hospitalId}>
                <td>
                  <div className="table-facility">
                    <span className="table-facility__icon"><Cross size={15} /></span>
                    <span><strong>{hospital.hospitalName}</strong><small>{hospital.specialtyName}</small></span>
                  </div>
                </td>
                <td><strong>{formatDistance(hospital.distanceKm)}</strong><small>{hospital.estimatedTravelMinutes} mnt</small></td>
                <td><strong>{hospital.currentQueueCount}</strong><small>orang</small></td>
                <td><strong>{hospital.availableBeds}</strong><small>tersedia</small></td>
                <td><span className={`status-label status-label--${getQueueClass(hospital.currentQueueCount).replace("queue-", "")}`}><span className="status-dot" />{getQueueLabel(hospital.currentQueueCount)}</span></td>
                <td><button className="row-action" onClick={() => onSelect(hospital)} aria-label={`Lihat detail ${hospital.hospitalName}`}><ChevronRight size={17} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChatMessageList({ messages, isLoading }: { messages: ChatMessage[]; isLoading: boolean }) {
  return (
    <div className="chat-messages" aria-live="polite">
      {messages.map((message, index) => (
        <div className={`chat-message chat-message--${message.role}`} key={`${message.role}-${index}-${message.content.slice(0, 12)}`}>
          <span className="chat-message__avatar">
            {message.role === "assistant" ? <Sparkles size={15} /> : <UserRound size={15} />}
          </span>
          <div>
            <small>{message.role === "assistant" ? "MedMatch AI" : "Anda"}</small>
            <p>{message.content}</p>
          </div>
        </div>
      ))}
      {isLoading ? (
        <div className="chat-message chat-message--assistant">
          <span className="chat-message__avatar"><Sparkles size={15} /></span>
          <div className="typing-indicator" aria-label="MedMatch sedang mengetik"><i /><i /><i /></div>
        </div>
      ) : null}
    </div>
  );
}

function ChatComposer({ value, isLoading, compact = false, onChange, onSubmit }: ChatComposerProps) {
  return (
    <form className={`chat-composer ${compact ? "chat-composer--compact" : ""}`} onSubmit={onSubmit}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Tanyakan tentang fasilitas..."
        aria-label="Pesan untuk asisten AI"
        disabled={isLoading}
      />
      <button type="submit" disabled={!value.trim() || isLoading} aria-label="Kirim pesan">
        <Send size={16} />
      </button>
    </form>
  );
}

function ChatPanel({
  messages,
  input,
  isLoading,
  online,
  onInputChange,
  onSubmit
}: ChatPanelProps) {
  return (
    <div className="chat-panel">
      <div className="chat-panel__header">
        <div className="chat-panel__title">
          <span className="chat-panel__logo"><Sparkles size={17} /></span>
          <div><strong>Asisten MedMatch</strong><span><i className="status-dot" /> {online ? "Siap membantu" : "Mode demo"}</span></div>
        </div>
        <button className="icon-button" aria-label="Opsi asisten"><MoreHorizontal size={18} /></button>
      </div>
      <div className="chat-panel__body"><ChatMessageList messages={messages} isLoading={isLoading} /></div>
      <div className="chat-panel__footer">
        <ChatComposer value={input} isLoading={isLoading} onChange={onInputChange} onSubmit={onSubmit} />
        <small>Jawaban AI bukan pengganti diagnosis tenaga kesehatan.</small>
      </div>
    </div>
  );
}

function ChatWidget({
  isOpen,
  messages,
  input,
  isLoading,
  online,
  onToggle,
  onInputChange,
  onSubmit
}: {
  isOpen: boolean;
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  online: boolean;
  onToggle: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className={`chat-widget ${isOpen ? "is-open" : ""}`}>
      <button className="chat-widget__header" onClick={onToggle} aria-expanded={isOpen}>
        <span className="chat-widget__avatar"><Sparkles size={17} /></span>
        <span className="chat-widget__copy"><strong>Tanya MedMatch AI</strong><small>{online ? "Siap membantu finding fasilitas" : "Coba pengalaman chat AI"}</small></span>
        <span className="chat-widget__toggle"><ChevronDown size={17} /></span>
      </button>
      {isOpen ? (
        <div className="chat-widget__body">
          <div className="chat-widget__messages"><ChatMessageList messages={messages} isLoading={isLoading} /></div>
          <ChatComposer value={input} isLoading={isLoading} compact onChange={onInputChange} onSubmit={onSubmit} />
          <small className="chat-widget__disclaimer">Informasi ini bukan diagnosis medis.</small>
        </div>
      ) : null}
    </section>
  );
}

function HospitalDetail({
  hospital,
  onClose
}: {
  hospital: HospitalRecommendation;
  onClose: () => void;
}) {
  const typeLabel = typeof hospital.hospitalType === "number" ? hospitalTypeLabels[hospital.hospitalType] : hospital.hospitalType;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="detail-drawer__header">
          <span className="panel-heading__eyebrow">Detail fasilitas</span>
          <button className="icon-button" onClick={onClose} aria-label="Tutup detail"><X size={19} /></button>
        </div>
        <div className="detail-drawer__hero">
          <span className="detail-drawer__icon"><Cross size={23} /></span>
          <div><h2>{hospital.hospitalName}</h2><p>{typeLabel} · {hospital.specialtyName}</p></div>
        </div>
        <div className="detail-score">
          <div className="detail-score__ring" style={{ "--score": `${hospital.recommendationScore * 3.6}deg` } as React.CSSProperties}>
            <strong>{Math.round(hospital.recommendationScore)}</strong><span>skor</span>
          </div>
          <div><strong>Rekomendasi sangat cocok</strong><p>Berdasarkan jarak, antrean, dan ketersediaan bed.</p></div>
        </div>
        <div className="detail-location"><MapPin size={16} /><span>{hospital.address}</span></div>
        <div className="detail-metrics">
          <div><Navigation size={16} /><span><small>Jarak</small><strong>{formatDistance(hospital.distanceKm)}</strong></span></div>
          <div><Clock3 size={16} /><span><small>Perjalanan</small><strong>{hospital.estimatedTravelMinutes} menit</strong></span></div>
          <div><BedDouble size={16} /><span><small>Bed tersedia</small><strong>{hospital.availableBeds} bed</strong></span></div>
          <div><UsersIcon /><span><small>Antrean</small><strong>{hospital.currentQueueCount} orang</strong></span></div>
        </div>
        <div className="detail-section">
          <div className="detail-section__heading"><strong>Informasi layanan</strong><span className="status-label status-label--normal"><span className="status-dot" /> Aktif</span></div>
          <div className="detail-service"><Stethoscope size={16} /><span><small>Spesialisasi</small><strong>{hospital.specialtyName}</strong></span><Check size={15} /></div>
          <div className="detail-service"><BedDouble size={16} /><span><small>Kelas tersedia</small><strong>{hospital.bedClass.replace("KELAS_", "Kelas ").toLowerCase()}</strong></span><Check size={15} /></div>
        </div>
        <div className="detail-drawer__actions">
          <a className="button button--primary" href={`tel:${hospital.phone.replace(/\s/g, "")}`}><Phone size={16} /> Hubungi fasilitas</a>
          <button className="button button--secondary"><Navigation size={16} /> Petakan rute</button>
        </div>
        <p className="detail-updated"><RefreshCw size={13} /> Data diperbarui {hospital.lastUpdated ? "beberapa menit lalu" : "terakhir"}</p>
      </aside>
    </div>
  );
}

function UsersIcon() {
  return <UserRound size={16} />;
}

function OverviewView({
  filters,
  specialties,
  locationLabel,
  isRefreshing,
  isLocating,
  dataSource,
  notice,
  noticeVisible,
  recommendations,
  selectedHospitalId,
  onFilterChange,
  onLocationChange,
  onSearch,
  onLocate,
  onQuickSearch,
  onDismissNotice,
  onSelectHospital
}: SearchHeroProps & {
  recommendations: HospitalRecommendation[];
  selectedHospitalId: string | null;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onSelectHospital: (hospital: HospitalRecommendation) => void;
}) {
  return (
    <>
      <SearchHero
        filters={filters}
        specialties={specialties}
        locationLabel={locationLabel}
        isRefreshing={isRefreshing}
        isLocating={isLocating}
        dataSource={dataSource}
        notice={notice}
        noticeVisible={noticeVisible}
        onFilterChange={onFilterChange}
        onLocationChange={onLocationChange}
        onSubmit={onSearch}
        onLocate={onLocate}
        onQuickSearch={onQuickSearch}
        onDismissNotice={onDismissNotice}
      />
      <div className="metrics-grid">
        <MetricCard icon={Building2} label="Fasilitas tersedia" value="128" detail="di sekitar lokasi" tone="mint" trend="+12% " />
        <MetricCard icon={Clock3} label="Rata-rata tunggu" value="18 mnt" detail="dibanding 24 mnt" tone="yellow" trend="−25% " />
        <MetricCard icon={BedDouble} label="Bed tersedia hari ini" value="342" detail="di 46 fasilitas" tone="blue" />
        <MetricCard icon={Navigation} label="Jangkauan pencarian" value="25 km" detail="dari lokasi Anda" tone="coral" />
      </div>
      <div className="content-grid content-grid--primary">
        <section className="panel recommendations-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-heading__eyebrow">Best match untuk Anda</span>
              <h2>Rekomendasi terbaik</h2>
            </div>
            <button className="panel-heading__link" onClick={() => onSelectHospital(recommendations[0])}>Lihat detail <ArrowRight size={14} /></button>
          </div>
          <div className="recommendation-grid">
            {recommendations.slice(0, 3).map((hospital, index) => (
              <RecommendationCard
                key={hospital.hospitalId}
                hospital={hospital}
                rank={index + 1}
                selected={selectedHospitalId === hospital.hospitalId}
                onSelect={onSelectHospital}
              />
            ))}
          </div>
        </section>
        <CapacityMap recommendations={recommendations} selectedHospitalId={selectedHospitalId} onSelect={onSelectHospital} />
      </div>
      <div className="content-grid content-grid--secondary">
        <FacilitiesTable recommendations={recommendations} onSelect={onSelectHospital} />
        <section className="insight-panel">
          <div className="insight-panel__orb insight-panel__orb--one" />
          <div className="insight-panel__orb insight-panel__orb--two" />
          <div className="insight-panel__content">
            <span className="insight-panel__label"><Zap size={14} /> Insight MedMatch</span>
            <h2>Rute yang lebih baik<br />dimulai dari data.</h2>
            <p>Algoritma kami memperhitungkan 4 faktor agar pasien tidak hanyauhn sampai, tetapi juga mendapat layanan lebih cepat.</p>
            <button className="button button--light" onClick={() => onSelectHospital(recommendations[0])}>Pelajari cara kerja <ArrowRight size={15} /></button>
          </div>
          <div className="insight-panel__rings"><span /><span /><span /></div>
        </section>
      </div>
    </>
  );
}

function RecommendationsView({
  filters,
  specialties,
  locationLabel,
  isRefreshing,
  isLocating,
  dataSource,
  notice,
  noticeVisible,
  recommendations,
  selectedHospitalId,
  onFilterChange,
  onLocationChange,
  onSearch,
  onLocate,
  onQuickSearch,
  onDismissNotice,
  onSelectHospital
}: SearchHeroProps & {
  recommendations: HospitalRecommendation[];
  selectedHospitalId: string | null;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onSelectHospital: (hospital: HospitalRecommendation) => void;
}) {
  return (
    <>
      <div className="page-intro">
        <div><span className="eyebrow"><span className="eyebrow__dot" /> Matching engine</span><h1>Fasilitas yang paling cocok</h1><p>Urutan diperbarui berdasarkan lokasi, waktu tempuh, antrean, dan ketersediaan tempat tidur.</p></div>
        <div className="page-intro__badge"><Sparkles size={17} /><span><strong>{recommendations.length} hasil</strong><small>teratas untuk Anda</small></span></div>
      </div>
      <SearchHero
        filters={filters}
        specialties={specialties}
        locationLabel={locationLabel}
        isRefreshing={isRefreshing}
        isLocating={isLocating}
        dataSource={dataSource}
        notice={notice}
        noticeVisible={noticeVisible}
        onFilterChange={onFilterChange}
        onLocationChange={onLocationChange}
        onSubmit={onSearch}
        onLocate={onLocate}
        onQuickSearch={onQuickSearch}
        onDismissNotice={onDismissNotice}
      />
      <div className="view-toolbar"><span><Filter size={15} /> Menampilkan {recommendations.length} fasilitas dalam radius {filters.maxDistanceKm} km</span><button><SlidersHorizontal size={15} /> Filter lanjutan</button></div>
      <div className="recommendation-grid recommendation-grid--wide">
        {recommendations.map((hospital, index) => (
          <RecommendationCard key={hospital.hospitalId} hospital={hospital} rank={index + 1} selected={selectedHospitalId === hospital.hospitalId} onSelect={onSelectHospital} />
        ))}
      </div>
    </>
  );
}

function FacilitiesView({ recommendations, onSelectHospital }: { recommendations: HospitalRecommendation[]; onSelectHospital: (hospital: HospitalRecommendation) => void }) {
  return (
    <>
      <div className="page-intro page-intro--facilities">
        <div><span className="eyebrow"><span className="eyebrow__dot" /> Database fasilitas</span><h1>Semua fasilitas di sekitar Anda</h1><p>Pantau ketersediaan dan waktu tunggu sebelum memilih tujuan rujukan.</p></div>
        <button className="button button--outline"><Filter size={16} /> Filter fasilitas</button>
      </div>
      <div className="facility-summary-strip">
        <div><span className="facility-summary-strip__icon facility-summary-strip__icon--mint"><Building2 size={18} /></span><span><strong>{recommendations.length}</strong><small>fasilitas ditemukan</small></span></div>
        <div><span className="facility-summary-strip__icon facility-summary-strip__icon--yellow"><Clock3 size={18} /></span><span><strong>18 mnt</strong><small>rata-rata antrean</small></span></div>
        <div><span className="facility-summary-strip__icon facility-summary-strip__icon--blue"><BedDouble size={18} /></span><span><strong>{recommendations.reduce((sum, item) => sum + item.availableBeds, 0)}</strong><small>bed tersedia</small></span></div>
        <div className="facility-summary-strip__sync"><span className="status-dot" /> Sinkronisasi aktif</div>
      </div>
      <FacilitiesTable recommendations={recommendations} onSelect={onSelectHospital} />
    </>
  );
}

function AssistantView({
  messages,
  input,
  isLoading,
  online,
  onInputChange,
  onSubmit
}: ChatPanelProps) {
  return (
    <>
      <div className="page-intro page-intro--assistant">
        <div><span className="eyebrow"><span className="eyebrow__dot" /> MedMatch intelligence</span><h1>Asisten yang membantu<br />menentukan langkah berikutnya.</h1><p>Tanyakan tentang fasilitas, kelas perawatan, atau cara membaca hasil pencarian.</p></div>
        <span className="assistant-orbit"><Sparkles size={26} /></span>
      </div>
      <div className="assistant-layout">
        <div className="assistant-feature-list">
          <article><span><Navigation size={17} /></span><div><strong>Temukan rute lebih cepat</strong><p>MedMatch membandingkan jarak dan waktu tempuh dari lokasi Anda.</p></div></article>
          <article><span><Clock3 size={17} /></span><div><strong>Perhatikan antrean</strong><p>Estimasi waktu tunggu membantu memilih fasilitas yang lebih siap.</p></div></article>
          <article><span><ShieldCheck size={17} /></span><div><strong>Informasi tetap aman</strong><p>Untuk kondisi darurat, selalu hubungi 119 atau tenaga kesehatan.</p></div></article>
        </div>
        <ChatPanel messages={messages} input={input} isLoading={isLoading} online={online} onInputChange={onInputChange} onSubmit={onSubmit} />
      </div>
    </>
  );
}

function App() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [filters, setFilters] = useState<RecommendationFilters>(defaultFilters);
  const [locationLabel, setLocationLabel] = useState("Jakarta Pusat");
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>(specialtyOptions);
  const [recommendations, setRecommendations] = useState<HospitalRecommendation[]>(mockRecommendations);
  const [dataSource, setDataSource] = useState<DataSource>("demo");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [notice, setNotice] = useState("Mode demo aktif. Hubungkan API MedMatch untuk menampilkan data fasilitas terbaru.");
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState<HospitalRecommendation | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatOnline, setChatOnline] = useState(false);

  const currentSpecialty = useMemo(() => getSpecialtyName(filters.specialtyCode, specialties), [filters.specialtyCode, specialties]);

  const loadRecommendations = async (nextFilters: RecommendationFilters, signal?: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const liveRecommendations = await medmatchApi.getRecommendations(nextFilters, signal);
      if (liveRecommendations.length > 0) {
        setRecommendations(liveRecommendations);
        setDataSource("live");
        setNotice("Data berhasil diperbarui dari MedMatch API.");
      } else {
        setRecommendations(getMockResults(nextFilters));
        setDataSource("demo");
        setNotice("API aktif tetapi belum ada data yang cocok. Menampilkan pratinjau data simulasi.");
      }
    } catch (error) {
      if (isAbortError(error)) return;
      setRecommendations(getMockResults(nextFilters));
      setDataSource("demo");
      setNotice("API belum dapat diakses. Menampilkan data simulasi agar pencarian tetap dapat dicoba.");
    } finally {
      if (!signal?.aborted) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const liveSpecialties = await medmatchApi.getSpecialties();
        if (liveSpecialties.length > 0) setSpecialties(liveSpecialties);
      } catch {
        setSpecialties(specialtyOptions);
      }

      await loadRecommendations(defaultFilters);
    };

    void loadInitialData();
  }, []);

  const handleNavigate = (view: ViewId) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  const handleFilterChange = (key: FilterKey, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleQuickSearch = (code: string) => {
    const nextFilters = { ...filters, specialtyCode: code };
    setFilters(nextFilters);
    void loadRecommendations(nextFilters);
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadRecommendations(filters);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setNotice("Browser tidak mendukung pengambilan lokasi otomatis.");
      setNoticeVisible(true);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextFilters = {
          ...filters,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setFilters(nextFilters);
        setLocationLabel("Lokasi saat ini");
        setIsLocating(false);
        void loadRecommendations(nextFilters);
      },
      () => {
        setIsLocating(false);
        setNotice("Izinkan akses lokasi untuk mencari fasilitas terdekat dari posisi Anda.");
        setNoticeVisible(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleRefresh = () => {
    void loadRecommendations(filters);
  };

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || isChatLoading) return;

    const history = chatMessages.slice(-8);
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const result = await medmatchApi.sendChat(message, history);
      if (!result.success || !result.reply) throw new Error(result.error ?? "Respons kosong");
      setChatMessages((current) => [...current, { role: "assistant", content: result.reply }]);
      setChatOnline(true);
    } catch {
      setChatOnline(false);
      setChatMessages((current) => [...current, { role: "assistant", content: fallbackChatReply(message) }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const view = activeView === "overview" ? (
    <OverviewView
      filters={filters}
      specialties={specialties}
      locationLabel={locationLabel}
      isRefreshing={isRefreshing}
      isLocating={isLocating}
      dataSource={dataSource}
      notice={notice}
      noticeVisible={noticeVisible}
      recommendations={recommendations}
      selectedHospitalId={selectedHospital?.hospitalId ?? null}
      onFilterChange={handleFilterChange}
      onLocationChange={setLocationLabel}
      onSearch={handleSearch}
      onSubmit={handleSearch}
      onLocate={handleLocate}
      onQuickSearch={handleQuickSearch}
      onDismissNotice={() => setNoticeVisible(false)}
      onSelectHospital={setSelectedHospital}
    />
  ) : activeView === "recommendations" ? (
    <RecommendationsView
      filters={filters}
      specialties={specialties}
      locationLabel={locationLabel}
      isRefreshing={isRefreshing}
      isLocating={isLocating}
      dataSource={dataSource}
      notice={notice}
      noticeVisible={noticeVisible}
      recommendations={recommendations}
      selectedHospitalId={selectedHospital?.hospitalId ?? null}
      onFilterChange={handleFilterChange}
      onLocationChange={setLocationLabel}
      onSearch={handleSearch}
      onSubmit={handleSearch}
      onLocate={handleLocate}
      onQuickSearch={handleQuickSearch}
      onDismissNotice={() => setNoticeVisible(false)}
      onSelectHospital={setSelectedHospital}
    />
  ) : activeView === "facilities" ? (
    <FacilitiesView recommendations={recommendations} onSelectHospital={setSelectedHospital} />
  ) : (
    <AssistantView messages={chatMessages} input={chatInput} isLoading={isChatLoading} online={chatOnline} onInputChange={setChatInput} onSubmit={handleChatSubmit} />
  );

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} isOpen={isMobileMenuOpen} onNavigate={handleNavigate} onClose={() => setIsMobileMenuOpen(false)} />
      {isMobileMenuOpen ? <button className="sidebar-scrim" onClick={() => setIsMobileMenuOpen(false)} aria-label="Tutup menu" /> : null}
      <div className="main-shell">
        <Topbar title={viewTitles[activeView]} dataSource={dataSource} isRefreshing={isRefreshing} onMenu={() => setIsMobileMenuOpen(true)} onRefresh={handleRefresh} />
        <main className="page-content">
          <div className="page-content__context"><span>Senang bertemu kembali, Andi</span><span className="page-content__specialty">Pencarian aktif · {currentSpecialty}</span></div>
          {view}
          <footer className="app-footer"><span>© 2025 MedMatch</span><span>Data fasilitas dapat berubah sewaktu-waktu.</span><span className="app-footer__secure"><ShieldCheck size={14} /> Terenkripsi & aman</span></footer>
        </main>
      </div>
      <ChatWidget isOpen={chatOpen} messages={chatMessages} input={chatInput} isLoading={isChatLoading} online={chatOnline} onToggle={() => setChatOpen((current) => !current)} onInputChange={setChatInput} onSubmit={handleChatSubmit} />
      {selectedHospital ? <HospitalDetail hospital={selectedHospital} onClose={() => setSelectedHospital(null)} /> : null}
    </div>
  );
}

export default App;
