import type { FormEvent } from "react";
import { Activity, ArrowRight, BedDouble, Building2, Check, ChevronDown, Clock3, Cross, Filter, Info, LocateFixed, MapPin, MoreHorizontal, Navigation, RefreshCw, Search, SlidersHorizontal, Sparkles, Stethoscope, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { bedClassOptions } from "../data/mockData";
import { getLocationLabel, indonesiaLocations } from "../data/indonesiaLocations";
import type { DataSource, HospitalRecommendation, RecommendationFilters, SpecialtyOption } from "../types";
import { FacilitiesTable } from "./Facilities";

type FilterKey = "specialtyCode" | "bedClass";

interface RecommendationCardProps { hospital: HospitalRecommendation; rank: number; selected: boolean; onSelect: (hospital: HospitalRecommendation) => void; }
interface CapacityMapProps { recommendations: HospitalRecommendation[]; locationLabel: string; selectedHospitalId: string | null; onSelect: (hospital: HospitalRecommendation) => void; }
interface SearchHeroProps {
  filters: RecommendationFilters; specialties: SpecialtyOption[]; locationLabel: string; isRefreshing: boolean; isLocating: boolean;
  dataSource: DataSource; notice: string; noticeVisible: boolean; onFilterChange: (key: FilterKey, value: string) => void;
  onLocationChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onLocate: () => void;
  onQuickSearch: (code: string) => void; onDismissNotice: () => void;
}

const mapMarkerPositions = [{ x: 48, y: 48 }, { x: 35, y: 35 }, { x: 68, y: 64 }, { x: 27, y: 69 }, { x: 76, y: 31 }];
function getQueueLabel(queue: number): string { if (queue <= 5) return "Antrian ringan"; if (queue <= 15) return "Normal"; return "Sedang padat"; }
function getQueueClass(queue: number): string { if (queue <= 5) return "queue-good"; if (queue <= 15) return "queue-normal"; return "queue-busy"; }
function formatNumber(value: number): string { return new Intl.NumberFormat("id-ID").format(value); }
const hospitalTypeLabels: Record<number, string> = { 1: "Rumah Sakit Umum", 2: "Rumah Sakit Khusus", 3: "Rumah Sakit Jiwa", 4: "Puskesmas", 5: "Klinik Pratama", 6: "Klinik Utama" };
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
            <select value={locationLabel} onChange={(event) => onLocationChange(event.target.value)} aria-label="Lokasi pasien">
              {!indonesiaLocations.some((location) => getLocationLabel(location) === locationLabel) ? <option value={locationLabel}>{locationLabel}</option> : null}
              {indonesiaLocations.map((location) => {
                const label = getLocationLabel(location);
                return <option key={label} value={label}>{label}</option>;
              })}
            </select>
            <ChevronDown size={16} />
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

function CapacityMap({ recommendations, locationLabel, selectedHospitalId, onSelect }: CapacityMapProps) {
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
        <span className="map-label map-label--north">{locationLabel.toUpperCase()}</span>
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

export function OverviewView({
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
  const totalBeds = recommendations.reduce((total, hospital) => total + hospital.availableBeds, 0);
  const averageWait = recommendations.length
    ? Math.round(recommendations.reduce((total, hospital) => total + hospital.estimatedWaitMinutes, 0) / recommendations.length)
    : 0;

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
        <MetricCard icon={Building2} label="Fasilitas tersedia" value={String(recommendations.length)} detail="hasil terverifikasi" tone="mint" />
        <MetricCard icon={Clock3} label="Rata-rata tunggu" value={`${averageWait} mnt`} detail="dari hasil tersedia" tone="yellow" />
        <MetricCard icon={BedDouble} label="Bed tersedia hari ini" value={formatNumber(totalBeds)} detail={`di ${recommendations.length} fasilitas`} tone="blue" />
        <MetricCard icon={Navigation} label="Jangkauan pencarian" value={`${filters.maxDistanceKm} km`} detail="dari lokasi Anda" tone="coral" />
      </div>
      <div className="content-grid content-grid--primary">
        <section className="panel recommendations-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-heading__eyebrow">Best match untuk Anda</span>
              <h2>Rekomendasi terbaik</h2>
            </div>
            {recommendations[0] ? <button className="panel-heading__link" onClick={() => onSelectHospital(recommendations[0])}>Lihat detail <ArrowRight size={14} /></button> : null}
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
        <CapacityMap recommendations={recommendations} locationLabel={locationLabel} selectedHospitalId={selectedHospitalId} onSelect={onSelectHospital} />
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
            {recommendations[0] ? <button className="button button--light" onClick={() => onSelectHospital(recommendations[0])}>Pelajari cara kerja <ArrowRight size={15} /></button> : null}
          </div>
          <div className="insight-panel__rings"><span /><span /><span /></div>
        </section>
      </div>
    </>
  );
}

export function RecommendationsView({
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
