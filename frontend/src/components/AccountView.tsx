import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { ApiError, medmatchApi } from "../api/medmatch";
import {
  deleteBiometric,
  getBiometricStatus,
  isBiometricAvailable,
  loginWithBiometric,
  registerBiometric,
  type BiometricStatusResponse
} from "../api/webauthn";
import type { AuthResponse } from "../types";

type AuthMode = "login" | "signup" | "forgot" | "reset";

interface AccountViewProps {
  session: AuthResponse | null;
  onAuthenticated: (session: AuthResponse) => void;
  onLogout: () => void;
  onBack: () => void;
  standalone?: boolean;
}

const inputClass = "h-12 w-full rounded-md border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-4 focus:ring-emerald-100";

export default function AccountView({ session, onAuthenticated, onLogout, onBack, standalone = false }: AccountViewProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatusResponse | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState("");
  const [biometricError, setBiometricError] = useState("");

  useEffect(() => {
    let cancelled = false;
    isBiometricAvailable().then((available) => {
      if (!cancelled) {
        setBiometricAvailable(available);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setBiometricStatus(null);
      return;
    }

    let cancelled = false;
    getBiometricStatus(session.token)
      .then((status) => {
        if (!cancelled) {
          setBiometricStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBiometricStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const refreshBiometricStatus = async (token: string) => {
    try {
      setBiometricStatus(await getBiometricStatus(token));
    } catch {
      setBiometricStatus(null);
    }
  };

  const handleRegisterBiometric = async () => {
    if (!session || biometricBusy) return;
    setBiometricBusy(true);
    setBiometricError("");
    setBiometricMessage("");
    try {
      await registerBiometric(session.token);
      await refreshBiometricStatus(session.token);
      setBiometricMessage("Sidik jari berhasil didaftarkan.");
    } catch (caught) {
      setBiometricError(caught instanceof ApiError ? caught.message : "Pendaftaran sidik jari gagal.");
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleDeleteBiometric = async (credentialId: string) => {
    if (!session || biometricBusy) return;
    setBiometricBusy(true);
    setBiometricError("");
    setBiometricMessage("");
    try {
      await deleteBiometric(session.token, credentialId);
      await refreshBiometricStatus(session.token);
      setBiometricMessage("Sidik jari dihapus.");
    } catch (caught) {
      setBiometricError(caught instanceof ApiError ? caught.message : "Gagal menghapus sidik jari.");
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (biometricBusy) return;
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Isi email terlebih dahulu untuk login dengan sidik jari.");
      return;
    }
    setBiometricBusy(true);
    try {
      onAuthenticated(await loginWithBiometric(email));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Login sidik jari gagal. Silakan coba lagi.");
    } finally {
      setBiometricBusy(false);
    }
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        onAuthenticated(await medmatchApi.signUp(email, password, fullName));
      } else if (mode === "login") {
        onAuthenticated(await medmatchApi.login(email, password));
      } else if (mode === "forgot") {
        const result = await medmatchApi.forgotPassword(email);
        setMessage(result.message);
        if (result.resetToken) {
          setResetToken(result.resetToken);
          setMode("reset");
        }
      } else {
        const result = await medmatchApi.resetPassword(resetToken, password);
        setMessage(result.message);
        setMode("login");
        setResetToken("");
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Permintaan belum berhasil. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (session) {
    const initials = session.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    return (
      <section className="w-full py-5 md:py-9">
        <button className="mb-6 inline-flex items-center gap-2 bg-transparent text-sm font-semibold text-slate-500 hover:text-ink" onClick={onBack}>
          <ArrowLeft size={17} /> Kembali ke ringkasan
        </button>
        <div className="grid min-h-[calc(100vh-210px)] overflow-hidden rounded-md border border-emerald-100 bg-white shadow-soft lg:grid-cols-[320px_1fr]">
          <aside className="bg-ink p-8 text-white">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-200 text-2xl font-bold text-ink">{initials}</div>
            <h1 className="mt-5 text-xl font-bold">{session.fullName}</h1>
            <p className="mt-1 break-all text-sm text-emerald-100">{session.email}</p>
            <span className="mt-5 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">{session.role}</span>
          </aside>
          <div className="p-7 md:p-10">
            <span className="text-xs font-bold uppercase tracking-widest text-brand">Akun MedMatch</span>
            <h2 className="mt-2 text-2xl font-bold text-ink">Profil dan keamanan</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 p-5"><UserRound className="text-brand" size={20} /><span className="mt-3 block text-xs text-slate-500">Nama lengkap</span><strong className="mt-1 block text-sm text-slate-800">{session.fullName}</strong></div>
              <div className="rounded-md border border-slate-200 p-5"><Mail className="text-brand" size={20} /><span className="mt-3 block text-xs text-slate-500">Alamat email</span><strong className="mt-1 block break-all text-sm text-slate-800">{session.email}</strong></div>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-md bg-emerald-50 p-4 text-sm text-emerald-900"><ShieldCheck size={20} /><span>Sesi aktif dan dilindungi token autentikasi.</span></div>
            {biometricAvailable ? (
              <div className="mt-6 rounded-md border border-slate-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-ink"><Fingerprint size={18} className="text-brand" /> Login sidik jari</span>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Gunakan sidik jari perangkat untuk masuk tanpa kata sandi.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegisterBiometric}
                    disabled={biometricBusy || (biometricStatus?.credentials.length ?? 0) >= 5}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-xs font-bold text-white transition hover:bg-emerald-900 disabled:opacity-60"
                  >
                    <Fingerprint size={16} /> {biometricStatus?.enabled ? "Daftarkan lagi" : "Aktifkan sidik jari"}
                  </button>
                </div>
                {biometricStatus?.credentials.length ? (
                  <ul className="mt-4 divide-y divide-slate-100">
                    {biometricStatus.credentials.map((credential) => (
                      <li key={credential.id} className="flex items-center justify-between gap-3 py-3">
                        <span className="text-sm text-slate-700">{credential.label}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{new Date(credential.createdAt).toLocaleDateString("id-ID")}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteBiometric(credential.id)}
                            disabled={biometricBusy}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-60"
                          >
                            Hapus
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-xs text-slate-400">Belum ada sidik jari terdaftar.</p>
                )}
                {biometricMessage ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{biometricMessage}</p> : null}
                {biometricError ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{biometricError}</p> : null}
              </div>
            ) : null}
            <button onClick={onLogout} className="mt-8 inline-flex h-11 items-center gap-2 rounded-md border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50"><LogOut size={17} /> Keluar dari akun</button>
          </div>
        </div>
      </section>
    );
  }

  const title = mode === "login" ? "Masuk ke akun" : mode === "signup" ? "Buat akun baru" : mode === "forgot" ? "Pulihkan akun" : "Atur kata sandi baru";
  const subtitle = mode === "login" ? "Lanjutkan pencarian fasilitas dan simpan preferensi Anda." : mode === "signup" ? "Mulai gunakan workspace pasien MedMatch." : mode === "forgot" ? "Kami akan membuat instruksi reset untuk email terdaftar." : "Masukkan token reset dan kata sandi baru Anda.";

  return (
    <section className="mx-auto grid min-h-[calc(100vh-190px)] w-full max-w-6xl items-center gap-12 py-6 lg:grid-cols-[1fr_440px] lg:py-10">
      <div className="hidden lg:block">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand"><HeartPulse size={17} /> MedMatch account</span>
        <h1 className="mt-5 max-w-lg text-4xl font-bold leading-tight text-ink">Satu akun untuk keputusan perawatan yang lebih tenang.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">Akses rekomendasi fasilitas, preferensi pencarian, dan bantuan kesehatan dalam workspace yang konsisten.</p>
        <div className="mt-8 space-y-4 text-sm text-slate-700">
          {["Kredensial disimpan dalam bentuk hash", "Token reset hanya berlaku satu kali", "Sesi dapat dihentikan kapan saja"].map((item) => <div key={item} className="flex items-center gap-3"><CheckCircle2 className="text-brand" size={19} /><span>{item}</span></div>)}
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        {!standalone ? <button className="mb-7 inline-flex items-center gap-2 bg-transparent text-sm font-semibold text-slate-500 hover:text-ink" onClick={onBack}><ArrowLeft size={17} /> Kembali</button> : null}
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-ink">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" ? <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Nama lengkap</span><span className="relative block"><UserRound className="absolute left-4 top-3.5 text-slate-400" size={18} /><input className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></span></label> : null}
          {mode !== "reset" ? <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Email</span><span className="relative block"><Mail className="absolute left-4 top-3.5 text-slate-400" size={18} /><input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></span></label> : null}
          {mode === "reset" ? <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Token reset</span><span className="relative block"><KeyRound className="absolute left-4 top-3.5 text-slate-400" size={18} /><input className={inputClass} value={resetToken} onChange={(event) => setResetToken(event.target.value)} required /></span></label> : null}
          {mode === "login" || mode === "signup" || mode === "reset" ? <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Kata sandi</span><span className="relative block"><LockKeyhole className="absolute left-4 top-3.5 text-slate-400" size={18} /><input className={`${inputClass} pr-11`} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /><button type="button" className="absolute right-3 top-3 grid h-7 w-7 place-items-center bg-transparent text-slate-400 hover:text-ink" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label> : null}

          {mode === "login" ? <button type="button" className="bg-transparent text-xs font-semibold text-brand hover:text-emerald-700" onClick={() => changeMode("forgot")}>Lupa kata sandi?</button> : null}
          {error ? <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          {message ? <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Memproses..." : mode === "login" ? "Masuk" : mode === "signup" ? "Buat akun" : mode === "forgot" ? "Kirim instruksi" : "Simpan kata sandi"}<ArrowRight size={17} /></button>
        </form>

        {mode === "login" && biometricAvailable ? (
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={biometricBusy}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            <Fingerprint size={18} /> {biometricBusy ? "Memindai sidik jari..." : "Masuk dengan sidik jari"}
          </button>
        ) : null}

        <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
          {mode === "login" ? <>Belum punya akun? <button className="bg-transparent font-bold text-brand" onClick={() => changeMode("signup")}>Daftar</button></> : mode === "signup" ? <>Sudah punya akun? <button className="bg-transparent font-bold text-brand" onClick={() => changeMode("login")}>Masuk</button></> : <button className="inline-flex items-center gap-2 bg-transparent font-bold text-brand" onClick={() => changeMode("login")}><ArrowLeft size={15} /> Kembali ke login</button>}
        </div>
      </div>
    </section>
  );
}
