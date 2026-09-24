import { ArrowRight, BedDouble, Building2, ChevronRight, Clock3, Cross, Filter } from "lucide-react";
import type { HospitalRecommendation } from "../types";

interface FacilitiesTableProps { recommendations: HospitalRecommendation[]; onSelect: (hospital: HospitalRecommendation) => void; }
function formatDistance(distance: number): string { return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1).replace(".0", "")} km`; }
function getQueueLabel(queue: number): string { if (queue <= 5) return "Antrian ringan"; if (queue <= 15) return "Normal"; return "Sedang padat"; }
function getQueueClass(queue: number): string { if (queue <= 5) return "queue-good"; if (queue <= 15) return "queue-normal"; return "queue-busy"; }
export function FacilitiesTable({ recommendations, onSelect }: FacilitiesTableProps) {
  return (
    <section className="panel facilities-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-heading__eyebrow">Around you</span>
          <h2>Fasilitas terdekat</h2>
        </div>
        <button className="panel-heading__link" disabled={!recommendations[0]} onClick={() => recommendations[0] && onSelect(recommendations[0])}>
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
            {recommendations.slice(0, 4).map((hospital) => {
              const isMasterDataOnly = hospital.isMasterDataOnly ?? false;
              return <tr key={hospital.hospitalId}>
                <td>
                  <div className="table-facility">
                    <span className="table-facility__icon"><Cross size={15} /></span>
                    <span><strong>{hospital.hospitalName}</strong><small>{hospital.specialtyName}</small></span>
                  </div>
                </td>
                <td><strong>{formatDistance(hospital.distanceKm)}</strong><small>{hospital.estimatedTravelMinutes} mnt</small></td>
                <td><strong>{isMasterDataOnly ? "—" : hospital.currentQueueCount}</strong><small>{isMasterDataOnly ? "belum tersedia" : "orang"}</small></td>
                <td><strong>{isMasterDataOnly ? "—" : hospital.availableBeds}</strong><small>{isMasterDataOnly ? "belum tersedia" : "tersedia"}</small></td>
                <td>{isMasterDataOnly ? <span className="status-label"><span className="status-dot" />Data MSI</span> : <span className={`status-label status-label--${getQueueClass(hospital.currentQueueCount).replace("queue-", "")}`}><span className="status-dot" />{getQueueLabel(hospital.currentQueueCount)}</span>}</td>
                <td><button className="row-action" onClick={() => onSelect(hospital)} aria-label={`Lihat detail ${hospital.hospitalName}`}><ChevronRight size={17} /></button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FacilitiesView({ recommendations, onSelectHospital }: { recommendations: HospitalRecommendation[]; onSelectHospital: (hospital: HospitalRecommendation) => void }) {
  const hasAvailabilityData = recommendations.some((hospital) => !hospital.isMasterDataOnly);
  return (
    <>
      <div className="page-intro page-intro--facilities">
        <div><span className="eyebrow"><span className="eyebrow__dot" /> Database fasilitas</span><h1>Semua fasilitas di sekitar Anda</h1><p>Pantau ketersediaan dan waktu tunggu sebelum memilih tujuan rujukan.</p></div>
        <button className="button button--outline"><Filter size={16} /> Filter fasilitas</button>
      </div>
      <div className="facility-summary-strip">
        <div><span className="facility-summary-strip__icon facility-summary-strip__icon--mint"><Building2 size={18} /></span><span><strong>{recommendations.length}</strong><small>fasilitas ditemukan</small></span></div>
        <div><span className="facility-summary-strip__icon facility-summary-strip__icon--yellow"><Clock3 size={18} /></span><span><strong>{hasAvailabilityData ? `${Math.round(recommendations.reduce((sum, item) => sum + item.estimatedWaitMinutes, 0) / recommendations.length)} mnt` : "—"}</strong><small>{hasAvailabilityData ? "rata-rata antrean" : "antrean belum tersedia"}</small></span></div>
        <div><span className="facility-summary-strip__icon facility-summary-strip__icon--blue"><BedDouble size={18} /></span><span><strong>{hasAvailabilityData ? recommendations.reduce((sum, item) => sum + item.availableBeds, 0) : "—"}</strong><small>{hasAvailabilityData ? "bed tersedia" : "bed belum tersedia"}</small></span></div>
        <div className="facility-summary-strip__sync"><span className="status-dot" /> Sinkronisasi aktif</div>
      </div>
      <FacilitiesTable recommendations={recommendations} onSelect={onSelectHospital} />
    </>
  );
}
