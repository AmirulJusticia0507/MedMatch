import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import AccountView from "./components/AccountView";
import { AssistantView, ChatWidget } from "./components/Chat";
import { FacilitiesView } from "./components/Facilities";
import { HospitalDetail } from "./components/HospitalDetail";
import { Sidebar, ThemeToggle, Topbar, viewTitles, type ViewId } from "./components/Layout";
import { OverviewView, RecommendationsView } from "./components/Recommendations";
import { HelpCenterView, PreferencesView } from "./components/SettingsViews";
import { medmatchApi } from "./api/medmatch";
import { initialChatMessages, mockRecommendations, specialtyOptions } from "./data/mockData";
import { getLocationCodes, getLocationLabel, indonesiaLocations } from "./data/indonesiaLocations";
import type { AuthResponse, ChatMessage, DataSource, HospitalRecommendation, RecommendationFilters, SpecialtyOption } from "./types";

type FilterKey = "specialtyCode" | "bedClass";
const defaultFilters: RecommendationFilters = {
  latitude: -6.2088,
  longitude: 106.8456,
  specialtyCode: "CARDIOLOGY",
  bedClass: "KELAS_1",
  maxDistanceKm: 25,
  maxResults: 5,
  provinceCode: "31",
  cityCode: "3171"
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
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("medmatch-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
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
  const [locationLabel, setLocationLabel] = useState("Jakarta Pusat, DKI Jakarta");
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>(specialtyOptions);
  const [recommendations, setRecommendations] = useState<HospitalRecommendation[]>(mockRecommendations);
  const [dataSource, setDataSource] = useState<DataSource>("demo");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [notice, setNotice] = useState("Mode demo aktif. Hubungkan API MedMatch untuk menampilkan data fasilitas terbaru.");
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState<HospitalRecommendation | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem("medmatch-sidebar-collapsed") === "true");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatOnline, setChatOnline] = useState(false);

  const currentSpecialty = useMemo(() => getSpecialtyName(filters.specialtyCode, specialties), [filters.specialtyCode, specialties]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("medmatch-theme", theme);
  }, [theme]);

  const loadRecommendations = async (nextFilters: RecommendationFilters, signal?: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const liveRecommendations = await medmatchApi.getRecommendations(nextFilters, signal);
      if (liveRecommendations.length > 0) {
        setRecommendations(liveRecommendations);
        setDataSource("live");
        setNotice(liveRecommendations.some((hospital) => hospital.isMasterDataOnly)
          ? "Fasilitas dimuat dari Master Sarana Index SATUSEHAT. Data antrean dan bed belum tersedia pada MSI."
          : "Data berhasil diperbarui dari MedMatch API.");
      } else {
        setRecommendations([]);
        setDataSource("live");
        setNotice("Belum ada data fasilitas terverifikasi untuk lokasi dan filter ini.");
      }
    } catch (error) {
      if (isAbortError(error)) return;
      const isJakarta = nextFilters.latitude >= -6.5 && nextFilters.latitude <= -5.9
        && nextFilters.longitude >= 106.5 && nextFilters.longitude <= 107.1;
      setRecommendations(isJakarta ? getMockResults(nextFilters) : []);
      setDataSource("demo");
      setNotice(isJakarta
        ? "API belum dapat diakses. Menampilkan data simulasi Jakarta."
        : "API belum dapat diakses dan data simulasi tidak tersedia untuk lokasi ini.");
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

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      localStorage.setItem("medmatch-sidebar-collapsed", String(!current));
      return !current;
    });
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

  const handleLocationChange = (label: string) => {
    const location = indonesiaLocations.find((item) => getLocationLabel(item) === label);
    if (!location) return;
    const codes = getLocationCodes(label);
    const nextFilters = {
      ...filters,
      latitude: location.latitude,
      longitude: location.longitude,
      provinceCode: codes?.provinceCode,
      cityCode: codes?.cityCode
    };
    setLocationLabel(label);
    setFilters(nextFilters);
    void loadRecommendations(nextFilters);
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
          longitude: position.coords.longitude,
          provinceCode: undefined,
          cityCode: undefined
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
        <ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")} className="theme-toggle--standalone" />
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
      onLocationChange={handleLocationChange}
      onSearch={handleSearch}
      onSubmit={handleSearch}
      onLocate={handleLocate}
      onQuickSearch={handleQuickSearch}
      onDismissNotice={() => setNoticeVisible(false)}
      onSelectHospital={setSelectedHospital}
      onNavigate={handleNavigate}
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
      onLocationChange={handleLocationChange}
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
  ) : activeView === "preferences" ? (
    <PreferencesView />
  ) : activeView === "help" ? (
    <HelpCenterView onOpenAssistant={() => handleNavigate("assistant")} />
  ) : (
    <AssistantView messages={chatMessages} input={chatInput} isLoading={isChatLoading} online={chatOnline} onInputChange={setChatInput} onSubmit={handleChatSubmit} />
  );

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} session={authSession} isOpen={isMobileMenuOpen} isCollapsed={isSidebarCollapsed} onNavigate={handleNavigate} onLogout={handleLogout} onToggleCollapse={handleToggleSidebar} onClose={() => setIsMobileMenuOpen(false)} />
      {isMobileMenuOpen ? <button className="sidebar-scrim" onClick={() => setIsMobileMenuOpen(false)} aria-label="Tutup menu" /> : null}
      <div className={`main-shell ${isSidebarCollapsed ? "main-shell--sidebar-collapsed" : ""}`}>
        <Topbar title={viewTitles[activeView]} dataSource={dataSource} isRefreshing={isRefreshing} onMenu={() => setIsMobileMenuOpen(true)} onRefresh={handleRefresh} onAccount={() => handleNavigate("account")} theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} />
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
