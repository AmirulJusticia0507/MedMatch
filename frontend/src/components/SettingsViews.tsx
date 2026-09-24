import { useMemo, useState } from "react";
import { Bell, Bot, ChevronDown, CircleHelp, LocateFixed, Mail, Phone, Save, ShieldCheck } from "lucide-react";

interface StoredPreferences {
  locationAccess: boolean;
  recommendationUpdates: boolean;
  emailUpdates: boolean;
  compactResults: boolean;
}

const defaultPreferences: StoredPreferences = {
  locationAccess: true,
  recommendationUpdates: true,
  emailUpdates: false,
  compactResults: false
};

function readPreferences(): StoredPreferences {
  try {
    return { ...defaultPreferences, ...JSON.parse(localStorage.getItem("medmatch-preferences") ?? "{}") };
  } catch {
    return defaultPreferences;
  }
}

export function PreferencesView() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof StoredPreferences) => {
    setSaved(false);
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };

  const save = () => {
    localStorage.setItem("medmatch-preferences", JSON.stringify(preferences));
    setSaved(true);
  };

  return (
    <section className="settings-view">
      <header className="page-intro">
        <div><span className="eyebrow"><span className="eyebrow__dot" /> Pengaturan personal</span><h1>Preferensi</h1><p>Atur pengalaman pencarian dan notifikasi MedMatch sesuai kebutuhan Anda.</p></div>
      </header>
      <div className="settings-layout">
        <div className="panel settings-panel">
          <div className="panel-heading"><div><span className="panel-heading__eyebrow">Pencarian</span><h2>Lokasi dan tampilan</h2></div><LocateFixed size={19} /></div>
          <PreferenceToggle label="Gunakan lokasi perangkat" description="Izinkan MedMatch mencari fasilitas dari posisi Anda." checked={preferences.locationAccess} onChange={() => toggle("locationAccess")} />
          <PreferenceToggle label="Tampilan hasil ringkas" description="Tampilkan lebih banyak fasilitas dalam satu layar." checked={preferences.compactResults} onChange={() => toggle("compactResults")} />
        </div>
        <div className="panel settings-panel">
          <div className="panel-heading"><div><span className="panel-heading__eyebrow">Komunikasi</span><h2>Notifikasi</h2></div><Bell size={19} /></div>
          <PreferenceToggle label="Pembaruan rekomendasi" description="Beritahu saat tersedia pilihan fasilitas yang lebih sesuai." checked={preferences.recommendationUpdates} onChange={() => toggle("recommendationUpdates")} />
          <PreferenceToggle label="Informasi melalui email" description="Terima ringkasan layanan dan pembaruan akun." checked={preferences.emailUpdates} onChange={() => toggle("emailUpdates")} />
        </div>
      </div>
      <div className="settings-actions"><span>{saved ? "Preferensi berhasil disimpan." : "Perubahan disimpan di perangkat ini."}</span><button className="button button--primary" onClick={save}><Save size={16} /> Simpan preferensi</button></div>
    </section>
  );
}

function PreferenceToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return <label className="preference-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={onChange} /><i aria-hidden="true" /></label>;
}

const faqs = [
  ["Bagaimana rekomendasi fasilitas dihitung?", "Hasil diurutkan dari lokasi pasien menggunakan jarak dan estimasi rute. Data fasilitas berasal dari Master Sarana Index SATUSEHAT."],
  ["Mengapa data bed dan antrean belum tersedia?", "Master Sarana Index menyediakan identitas dan lokasi fasilitas, tetapi tidak menyediakan data bed atau antrean waktu nyata."],
  ["Bagaimana memakai lokasi saat ini?", "Tekan ikon lokasi pada formulir pencarian, izinkan akses lokasi di browser, lalu MedMatch akan mencari fasilitas terdekat."],
  ["Apakah MedMatch menggantikan tenaga medis?", "Tidak. MedMatch membantu menemukan fasilitas, bukan memberikan diagnosis. Untuk kondisi darurat segera hubungi 119."]
];

export function HelpCenterView({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  const [query, setQuery] = useState("");
  const visibleFaqs = useMemo(() => faqs.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <section className="settings-view">
      <header className="help-hero"><span><CircleHelp size={22} /></span><h1>Pusat Bantuan</h1><p>Temukan jawaban atau lanjutkan percakapan dengan Asisten MedMatch.</p><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari bantuan..." aria-label="Cari bantuan" /></header>
      <div className="help-grid">
        <div className="panel help-faq"><div className="panel-heading"><div><span className="panel-heading__eyebrow">Pertanyaan umum</span><h2>Jawaban cepat</h2></div></div>{visibleFaqs.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={17} /></summary><p>{answer}</p></details>)}{visibleFaqs.length === 0 ? <p className="help-empty">Tidak ada jawaban yang cocok.</p> : null}</div>
        <aside className="help-contact">
          <div><Bot size={21} /><h2>Asisten MedMatch</h2><p>Tanyakan cara menggunakan pencarian atau memahami informasi fasilitas.</p><button className="button button--primary" onClick={onOpenAssistant}>Buka Asisten AI</button></div>
          <div><ShieldCheck size={21} /><h2>Bantuan darurat</h2><p>Untuk keadaan gawat darurat medis, hubungi layanan darurat nasional.</p><a className="button button--outline" href="tel:119"><Phone size={16} /> Hubungi 119</a></div>
          <div className="help-email"><Mail size={18} /><span><strong>Dukungan akun</strong><small>support@medmatch.id</small></span></div>
        </aside>
      </div>
    </section>
  );
}
