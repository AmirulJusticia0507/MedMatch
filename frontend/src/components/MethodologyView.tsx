import { ArrowLeft, ArrowRight, BedDouble, Building2, Clock3, Database, MapPinned, Route, ShieldCheck } from "lucide-react";

const factors = [
  { icon: Route, weight: "30%", title: "Waktu tempuh", description: "Estimasi perjalanan dihitung dari posisi pasien menuju fasilitas menggunakan rute jalan OSRM." },
  { icon: Clock3, weight: "40%", title: "Antrean", description: "Saat data antrean tersedia, fasilitas dengan estimasi tunggu lebih singkat mendapat prioritas lebih tinggi." },
  { icon: BedDouble, weight: "20%", title: "Ketersediaan bed", description: "Ketersediaan kelas perawatan digunakan ketika sumber operasional rumah sakit menyediakan datanya." },
  { icon: Building2, weight: "10%", title: "Kesesuaian layanan", description: "Jenis fasilitas dan layanan yang tersedia dicocokkan dengan kebutuhan pencarian pasien." }
];

export function MethodologyView({ onBack, onOpenRecommendations }: { onBack: () => void; onOpenRecommendations: () => void }) {
  return (
    <section className="methodology-view">
      <button className="methodology-back" onClick={onBack}><ArrowLeft size={17} /> Kembali ke ringkasan</button>
      <header className="methodology-hero">
        <span className="eyebrow eyebrow--light"><span className="eyebrow__dot" /> Transparansi rekomendasi</span>
        <h1>Cara MedMatch menyusun rekomendasi</h1>
        <p>MedMatch menggabungkan lokasi, data fasilitas, dan informasi operasional yang tersedia untuk membantu pasien membandingkan tujuan perawatan.</p>
      </header>
      <div className="methodology-steps">
        <article><span><MapPinned size={20} /></span><strong>1. Tentukan lokasi</strong><p>Koordinat pasien menjadi titik awal pencarian dalam radius yang dipilih.</p></article>
        <article><span><Database size={20} /></span><strong>2. Ambil fasilitas</strong><p>Identitas dan koordinat rumah sakit dimuat dari Master Sarana Index SATUSEHAT.</p></article>
        <article><span><Route size={20} /></span><strong>3. Hitung perjalanan</strong><p>OSRM menghitung jarak jalan dan estimasi waktu menuju setiap fasilitas.</p></article>
        <article><span><ShieldCheck size={20} /></span><strong>4. Urutkan hasil</strong><p>Fasilitas dibandingkan memakai faktor yang datanya tersedia dan dapat diverifikasi.</p></article>
      </div>
      <section className="panel methodology-factors">
        <div className="panel-heading"><div><span className="panel-heading__eyebrow">Matching engine</span><h2>Bobot penilaian lengkap</h2></div></div>
        <div className="methodology-factor-grid">
          {factors.map(({ icon: Icon, weight, title, description }) => <article key={title}><span className="methodology-factor__icon"><Icon size={19} /></span><span className="methodology-factor__weight">{weight}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
      <div className="methodology-note"><Database size={20} /><div><strong>Catatan tentang data SATUSEHAT MSI</strong><p>MSI saat ini menyediakan data master dan lokasi fasilitas. Karena data antrean dan bed belum tersedia dari sumber tersebut, hasil MSI diurutkan berdasarkan jarak rute dan tidak diberi skor kecocokan operasional palsu.</p></div></div>
      <div className="methodology-action"><button className="button button--primary" onClick={onOpenRecommendations}>Lihat rekomendasi <ArrowRight size={16} /></button></div>
    </section>
  );
}
