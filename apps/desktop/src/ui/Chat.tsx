import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DEFAULT_SIGNAL_API_BASE_URL,
  signalApiUrl,
} from "@harness-health/core";

type Mode = "text" | "voice";

interface TextMessage {
  kind: "text";
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface ToolEvent {
  kind: "tool";
  id: string;
  name: string;
  label: string;
  done: boolean;
  summary?: string;
}

interface StatusEvent {
  kind: "status";
  id: string;
  text: string;
}

type ChatItem = TextMessage | ToolEvent | StatusEvent;

const SUGGESTIONS = [
  { label: "Why was my alignment low?", sub: "Explain yesterday's score" },
  { label: "Find a session", sub: "Search my coding agent history" },
  { label: "What's my biggest friction?", sub: "Based on this week's logs" },
  { label: "How was my week?", sub: "Trend across the last 7 days" },
];

const REPLY_POOL = [
  "What should I clean up from this?",
  "What pattern keeps repeating?",
  "How do I set up my next session better?",
  "Which sessions are worth keeping?",
  "Where did the agent get stuck most?",
  "What context should I carry forward?",
  "What would a good handoff look like?",
  "What's creating the most friction right now?",
  "How can I avoid this next time?",
];

function ReplyChips({
  turn,
  onSuggest,
}: {
  turn: number;
  onSuggest: (text: string) => void;
}): ReactElement {
  const start = (turn * 3) % REPLY_POOL.length;
  const chips = [0, 1, 2].map(
    (i) => REPLY_POOL[(start + i) % REPLY_POOL.length]
  );
  return (
    <div className="chat-reply-chips">
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          className="chat-reply-chip"
          onClick={() => onSuggest(c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function AssistantIcon(): ReactElement {
  return (
    <div className="chat-ai-icon" aria-hidden="true">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="10" cy="10" r="7" />
        <path
          d="M7 10c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3"
          strokeLinecap="round"
        />
        <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

function EmptyState({
  onSuggest,
}: {
  onSuggest: (text: string) => void;
}): ReactElement {
  return (
    <div className="chat-empty">
      <p className="chat-empty-title">How can I help you?</p>
      <div className="chat-suggestions-grid">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            className="chat-suggestion-card"
            onClick={() => onSuggest(s.label)}
          >
            <span className="chat-suggestion-label">{s.label}</span>
            <span className="chat-suggestion-sub">{s.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingRow(): ReactElement {
  return (
    <div className="chat-row chat-row-assistant">
      <AssistantIcon />
      <div className="chat-thinking">
        <span className="chat-thinking-dot" />
        <span className="chat-thinking-dot" />
        <span className="chat-thinking-dot" />
      </div>
    </div>
  );
}

function ToolEventRow({ item }: { item: ToolEvent }): ReactElement {
  return (
    <div className="chat-row chat-row-assistant">
      <div className="chat-ai-icon-spacer" aria-hidden="true" />
      <div
        className={`chat-tool-call${item.done ? " chat-tool-call-done" : ""}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 8a6 6 0 1 0 12 0A6 6 0 0 0 2 8z" strokeLinecap="round" />
          <path d="M8 5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{item.label}</span>
        {item.done && item.summary ? (
          <span className="chat-tool-summary">— {item.summary}</span>
        ) : null}
        {item.done ? (
          <svg
            className="chat-tool-check"
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M2 6l3 3 5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="chat-tool-dots">
            <span />
            <span />
            <span />
          </span>
        )}
      </div>
    </div>
  );
}

function StatusRow({ item }: { item: StatusEvent }): ReactElement {
  return (
    <div className="chat-row chat-row-assistant">
      <div className="chat-ai-icon-spacer" aria-hidden="true" />
      <p className="chat-status-line">{item.text}</p>
    </div>
  );
}

function MessageRow({ item }: { item: ChatItem }): ReactElement {
  if (item.kind === "tool") return <ToolEventRow item={item} />;
  if (item.kind === "status") return <StatusRow item={item} />;
  if (item.role === "user") {
    return (
      <div className="chat-row chat-row-user">
        <div className="chat-bubble-user">{item.content}</div>
      </div>
    );
  }
  return (
    <div className="chat-row chat-row-assistant">
      <AssistantIcon />
      <div className="chat-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {item.content}
        </ReactMarkdown>
        {item.streaming ? (
          <span className="chat-cursor" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
}

const SESSION_KEY = "health-chat-session-id";

async function configuredCloudRoute(path: string): Promise<string> {
  const config = await window.hd?.config.get().catch(() => null);
  return signalApiUrl(
    config?.cloudSync.cloudApiBaseUrl || DEFAULT_SIGNAL_API_BASE_URL,
    path
  );
}

function TextChat(): ReactElement {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(
    typeof localStorage !== "undefined"
      ? localStorage.getItem(SESSION_KEY)
      : null
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    sessionIdRef.current = null;
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const itemCount = items.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom on new items
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [itemCount]);

  function autoResize(): void {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function stop(): void {
    abortRef.current?.abort();
  }

  async function send(text?: string): Promise<void> {
    const value = (text ?? input).trim();
    if (!value || busy) return;

    setInput("");
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userItem: TextMessage = {
      kind: "text",
      id: `u-${Date.now()}`,
      role: "user",
      content: value,
    };
    const assistantItem: TextMessage = {
      kind: "text",
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setItems((prev) => [...prev, userItem, assistantItem]);
    setBusy(true);
    setThinking(true);

    setThinking(false);
    setItems((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.kind === "text" && last.role === "assistant") {
        next[next.length - 1] = {
          ...last,
          streaming: false,
          content:
            "Text chat over private Harness Health content is disabled in the privacy-first sync model. Reports stay on this Mac and companion devices receive them only over private WebRTC sync.",
        };
      }
      return next;
    });
    setBusy(false);
    textareaRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="chat-text-inner">
      <div className="chat-messages">
        {items.length === 0 ? (
          <EmptyState onSuggest={(t) => void send(t)} />
        ) : (
          (() => {
            const assistantTurns = items.filter(
              (it): it is TextMessage =>
                it.kind === "text" && it.role === "assistant"
            ).length;
            const lastItem = items[items.length - 1];
            const showChips =
              !busy &&
              !thinking &&
              lastItem?.kind === "text" &&
              lastItem.role === "assistant" &&
              !lastItem.streaming;
            return (
              <>
                {items.map((item) => (
                  <MessageRow key={item.id} item={item} />
                ))}
                {showChips && (
                  <ReplyChips
                    turn={assistantTurns - 1}
                    onSuggest={(t) => void send(t)}
                  />
                )}
              </>
            );
          })()
        )}
        {thinking && <ThinkingRow />}
        {error && <p className="chat-error">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-composer">
        <div className="chat-composer-inner">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Ask Health Coach anything…"
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
          {busy ? (
            <button
              type="button"
              className="chat-send-btn chat-stop-btn"
              onClick={stop}
              aria-label="Stop"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor">
                <rect x="5" y="5" width="10" height="10" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="chat-send-btn"
              onClick={() => void send()}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3l7 14-7-3.5L3 17l7-14z" />
              </svg>
            </button>
          )}
        </div>
        <div className="chat-footer-row">
          <p className="chat-footer-hint">
            Health Coach can make mistakes. Check important info.
          </p>
          {items.length > 0 && !busy && (
            <button
              type="button"
              className="chat-new-btn"
              onClick={() => {
                sessionIdRef.current = null;
                localStorage.removeItem(SESSION_KEY);
                setItems([]);
                setError(null);
              }}
            >
              New chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Voice mode ────────────────────────────────────────────────────────────────

type VoiceStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "agent-speaking"
  | "error";

function VoiceMode(): ReactElement {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioElemsRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    let active = true;

    function cleanupAudio() {
      for (const el of audioElemsRef.current) el.remove();
      audioElemsRef.current = [];
    }

    async function connect() {
      setStatus("connecting");
      setErrorMsg(null);
      try {
        const res = await fetch(await configuredCloudRoute("/voice/token"), {
          method: "POST",
        });
        if (!res.ok) throw new Error(`Token error ${res.status}`);
        const { token, url } = (await res.json()) as {
          token: string;
          url: string;
        };

        if (!active) return; // unmounted before token arrived

        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (!active) return;
          if (state === ConnectionState.Connected) setStatus("connected");
          if (state === ConnectionState.Disconnected) setStatus("idle");
        });

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach() as HTMLAudioElement;
            el.autoplay = true;
            audioElemsRef.current.push(el);
            document.body.appendChild(el);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            track.detach();
            cleanupAudio();
          }
        });

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (!active) return;
          const agentSpeaking = speakers.some(
            (s) => s.identity !== room.localParticipant.identity
          );
          setStatus(agentSpeaking ? "agent-speaking" : "connected");
        });

        await room.connect(url, token);
        // echo cancellation prevents the agent's audio from looping back into the mic
        await room.localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Connection failed");
      }
    }

    void connect();

    return () => {
      active = false;
      cleanupAudio();
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  async function togglePause(): Promise<void> {
    const room = roomRef.current;
    if (!room) return;
    const next = !paused;
    // Freeze/unfreeze mic
    const pub = room.localParticipant.getTrackPublication(
      Track.Source.Microphone
    );
    if (pub) {
      if (next) await pub.mute();
      else if (!muted) await pub.unmute();
    }
    // Freeze/unfreeze agent audio
    for (const el of audioElemsRef.current) {
      el.muted = next;
    }
    setPaused(next);
  }

  async function toggleMute(): Promise<void> {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(
      Track.Source.Microphone
    );
    if (!pub) return;
    const next = !muted;
    if (next) {
      await pub.mute();
    } else {
      if (!paused) await pub.unmute();
    }
    setMuted(next);
  }

  const statusLabel: Record<VoiceStatus, string> = {
    idle: "Starting…",
    connecting: "Connecting…",
    connected: paused ? "Paused" : "Listening",
    "agent-speaking": paused ? "Paused" : "Health Coach is speaking",
    error: errorMsg ?? "Error",
  };

  return (
    <div className="voice-shell">
      <div
        className={`voice-orb${status === "agent-speaking" && !paused ? " voice-orb-active" : ""}${paused ? " voice-orb-paused" : ""}`}
      >
        <AssistantIcon />
      </div>
      <p className="voice-status">{statusLabel[status]}</p>
      {status !== "error" && status !== "idle" && (
        <div className="voice-controls">
          <button
            type="button"
            className={`voice-mic-btn${muted ? " voice-mic-muted" : ""}`}
            onClick={() => void toggleMute()}
            disabled={paused}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path
                  d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"
                  strokeLinecap="round"
                />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className={`voice-pause-btn${paused ? " voice-paused" : ""}`}
            onClick={() => void togglePause()}
            aria-label={paused ? "Resume" : "Pause"}
          >
            {paused ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            )}
          </button>
        </div>
      )}
      {status === "error" && (
        <p className="chat-error" style={{ marginTop: "1rem" }}>
          {errorMsg ?? "Failed to connect"}
          <br />
          <small>Make sure livekit-server and voice agent are running.</small>
        </p>
      )}
    </div>
  );
}

// ── Main Chat shell with mode toggle ─────────────────────────────────────────

export default function Chat(): ReactElement {
  const [mode, setMode] = useState<Mode>("text");

  return (
    <div className="chat-shell">
      <div className="chat-mode-toggle">
        <button
          type="button"
          className={mode === "text" ? "active" : ""}
          onClick={() => setMode("text")}
        >
          Text
        </button>
        <button
          type="button"
          className={mode === "voice" ? "active" : ""}
          onClick={() => setMode("voice")}
        >
          Voice
        </button>
      </div>
      {mode === "text" ? <TextChat /> : <VoiceMode />}
    </div>
  );
}
