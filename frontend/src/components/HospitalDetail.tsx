import { useEffect } from "react";
import { BedDouble, Check, Clock3, Cross, MapPin, Navigation, Phone, RefreshCw, Stethoscope, UserRound, X } from "lucide-react";
import type { HospitalRecommendation } from "../types";

const hospitalTypeLabels: Record<number, string> = { 1: "Rumah Sakit Umum", 2: "Rumah Sakit Khusus", 3: "Rumah Sakit Jiwa", 4: "Puskesmas", 5: "Klinik Pratama", 6: "Klinik Utama" };
function formatDistance(distance: number): string { return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1).replace(".0", "")} km`; }
function UsersIcon() { return <UserRound size={15} />; }
export function HospitalDetail({
  hospital,
  onClose
}: {
  hospital: HospitalRecommendation;
  onClose: () => void;
}) {
  const typeLabel = typeof hospital.hospitalType === "number" ? hospitalTypeLabels[hospital.hospitalType] : hospital.hospitalType;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`Detail ${hospital.hospitalName}`} onClick={(event) => event.stopPropagation()}>
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
