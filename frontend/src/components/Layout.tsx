import { ArrowRight, Bell, Bot, Building2, CalendarDays, ChevronDown, ChevronRight, CircleHelp, Cross, LayoutDashboard, LogOut, Menu, RefreshCw, Settings, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AuthResponse, DataSource } from "../types";

export type ViewId = "overview" | "recommendations" | "facilities" | "assistant" | "account";

interface NavItem { id: ViewId; label: string; icon: LucideIcon; badge?: string; }

const navItems: NavItem[] = [
  { id: "overview", label: "Ringkasan", icon: LayoutDashboard },
  { id: "recommendations", label: "Rekomendasi", icon: Sparkles, badge: "5" },
  { id: "facilities", label: "Fasilitas", icon: Building2 },
  { id: "assistant", label: "Asisten AI", icon: Bot, badge: "AI" },
  { id: "account", label: "Akun", icon: UserRound }
];

export const viewTitles: Record<ViewId, string> = {
  overview: "Ringkasan", recommendations: "Rekomendasi", facilities: "Fasilitas", assistant: "Asisten AI", account: "Akun"
};

function formatToday(): string {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
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

export function Sidebar({
  activeView,
  session,
  isOpen,
  onNavigate,
  onLogout,
  onClose
}: {
  activeView: ViewId;
  session: AuthResponse | null;
  isOpen: boolean;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
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

      <button className="sidebar__profile" onClick={() => onNavigate("account")} aria-label="Buka akun">
        <div className="avatar avatar--light">{session ? session.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "?"}</div>
        <div>
          <strong>{session?.fullName ?? "Masuk ke MedMatch"}</strong>
          <span>{session?.email ?? "Patient workspace"}</span>
        </div>
        <ChevronDown size={15} />
      </button>

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
        <button className="sidebar__nav-item" onClick={() => onNavigate("account")}>
          <Settings size={18} />
          <span>Preferensi</span>
        </button>
        <button className="sidebar__nav-item" onClick={() => onNavigate("assistant")}>
          <CircleHelp size={18} />
          <span>Pusat bantuan</span>
        </button>
        {session ? <button className="sidebar__nav-item" onClick={onLogout}><LogOut size={18} /><span>Keluar</span></button> : null}
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

export function Topbar({
  title,
  dataSource,
  isRefreshing,
  onMenu,
  onRefresh,
  onAccount
}: {
  title: string;
  dataSource: DataSource;
  isRefreshing: boolean;
  onMenu: () => void;
  onRefresh: () => void;
  onAccount: () => void;
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
        <button className="avatar avatar--dark" onClick={onAccount} aria-label="Buka akun"><UserRound size={17} /></button>
      </div>
    </header>
  );
}
