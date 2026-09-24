import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import AccountView from "./components/AccountView";
import { AssistantView, ChatWidget } from "./components/Chat";
import { FacilitiesView } from "./components/Facilities";
import { HospitalDetail } from "./components/HospitalDetail";
import { Sidebar, Topbar, viewTitles, type ViewId } from "./components/Layout";
import { OverviewView, RecommendationsView } from "./components/Recommendations";
import { medmatchApi } from "./api/medmatch";
import { initialChatMessages, mockRecommendations, specialtyOptions } from "./data/mockData";
import type { AuthResponse, ChatMessage, DataSource, HospitalRecommendation, RecommendationFilters, SpecialtyOption } from "./types";

type FilterKey = "specialtyCode" | "bedClass";
const defaultFilters: RecommendationFilters = {
  latitude: -6.2088,
  longitude: 106.8456,
  specialtyCode: "CARDIOLOGY",
  bedClass: "KELAS_1",
  maxDistanceKm: 25,
  maxResults: 5
};

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

function fallbackChatReply(message: string): string {
  if (/emergency|darurat|nyeri dada|sesak|tidak bisa bernapas/i.test(message)) {
    return "Jika pasien mengalami darurat seperti nyeri dada berat, sesak napas, atau kehilangan kesadaran, segera hubungi 119 atau layanan gawat darurat terdekat. MedMatch tidak menggantikan pemeriksaan tenaga kesehatan.";
  }

  return "Saya bisa membantu merangkum pilihan fasilitas. Untuk hasil yang lebih akurat, isi lokasi, spesialisasi, dan kelas perawatan pada pencarian MedMatch.";
}

function App() {
  const [activeView, setActiveView] = useState<ViewId>(() => {
    const hash = window.location.hash.slice(1) as ViewId;
    return viewTitles[hash] ? hash : "overview";
  });
  const [authSession, setAuthSession] = useState<AuthResponse | null>(() => {
    try {
      const stored = sessionStorage.getItem("medmatch-auth");
      if (!stored) return null;
      const session = JSON.parse(stored) as AuthResponse;
      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        sessionStorage.removeItem("medmatch-auth");
        return null;
      }
      return session;
    } catch {
      return null;
    }
  });
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

  useEffect(() => {
    const syncViewFromHash = () => {
      const hash = window.location.hash.slice(1) as ViewId;
      if (viewTitles[hash]) setActiveView(hash);
    };
    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, []);

  const handleNavigate = (view: ViewId) => {
    setActiveView(view);
    window.location.hash = view;
    setIsMobileMenuOpen(false);
  };

  const handleAuthenticated = (session: AuthResponse) => {
    sessionStorage.setItem("medmatch-auth", JSON.stringify(session));
    setAuthSession(session);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("medmatch-auth");
    setAuthSession(null);
    setActiveView("overview");
    window.location.hash = "overview";
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

  if (!authSession) {
    return (
      <main className="min-h-screen bg-canvas px-5 py-6 sm:px-8">
        <AccountView session={null} onAuthenticated={handleAuthenticated} onLogout={handleLogout} onBack={() => undefined} standalone />
      </main>
    );
  }

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
  ) : activeView === "account" ? (
    <AccountView session={authSession} onAuthenticated={handleAuthenticated} onLogout={handleLogout} onBack={() => handleNavigate("overview")} />
  ) : (
    <AssistantView messages={chatMessages} input={chatInput} isLoading={isChatLoading} online={chatOnline} onInputChange={setChatInput} onSubmit={handleChatSubmit} />
  );

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} session={authSession} isOpen={isMobileMenuOpen} onNavigate={handleNavigate} onLogout={handleLogout} onClose={() => setIsMobileMenuOpen(false)} />
      {isMobileMenuOpen ? <button className="sidebar-scrim" onClick={() => setIsMobileMenuOpen(false)} aria-label="Tutup menu" /> : null}
      <div className="main-shell">
        <Topbar title={viewTitles[activeView]} dataSource={dataSource} isRefreshing={isRefreshing} onMenu={() => setIsMobileMenuOpen(true)} onRefresh={handleRefresh} onAccount={() => handleNavigate("account")} />
        <main className="page-content">
          {activeView !== "account" ? <div className="page-content__context"><span>Senang bertemu kembali, {authSession?.fullName.split(" ")[0] ?? "Anda"}</span><span className="page-content__specialty">Pencarian aktif · {currentSpecialty}</span></div> : null}
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
