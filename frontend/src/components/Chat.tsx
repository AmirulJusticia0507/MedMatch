import type { FormEvent } from "react";
import { ChevronDown, Clock3, MoreHorizontal, Navigation, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { ChatMessage } from "../types";

interface ChatComposerProps { value: string; isLoading: boolean; compact?: boolean; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; }
interface ChatPanelProps { messages: ChatMessage[]; input: string; isLoading: boolean; online: boolean; onInputChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; }
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

export function ChatWidget({
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

export function AssistantView({
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
