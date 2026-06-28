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

const API_URL = "http://localhost:8000";
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
}

type ChatItem = TextMessage | ToolEvent;

const SUGGESTIONS = [
  { label: "Why was my alignment low?", sub: "Explain yesterday's score" },
  { label: "Find a session", sub: "Search my coding agent history" },
  { label: "What's my biggest friction?", sub: "Based on this week's logs" },
  { label: "How was my week?", sub: "Trend across the last 7 days" },
];

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
      <div className={`chat-tool-call${item.done ? " chat-tool-call-done" : ""}`}>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 8a6 6 0 1 0 12 0A6 6 0 0 0 2 8z" strokeLinecap="round" />
          <path d="M8 5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{item.label}</span>
        {item.done ? (
          <svg className="chat-tool-check" aria-hidden="true" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="chat-tool-dots">
            <span /><span /><span />
          </span>
        )}
      </div>
    </div>
  );
}

function MessageRow({ item }: { item: ChatItem }): ReactElement {
  if (item.kind === "tool") return <ToolEventRow item={item} />;
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
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
        {item.streaming ? (
          <span className="chat-cursor" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
}

function TextChat(): ReactElement {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

    const abort = new AbortController();
    abortRef.current = abort;

    // Build history from text messages only (no tool events)
    const history = [...items, userItem]
      .filter((item): item is TextMessage => item.kind === "text")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.done) break;
            if (payload.error) throw new Error(payload.error);
            if (payload.type === "tool_call") {
              setThinking(false);
              const toolItem: ToolEvent = {
                kind: "tool",
                id: `tool-${Date.now()}-${payload.name}`,
                name: payload.name,
                label: payload.label,
                done: false,
              };
              setItems((prev) => {
                // Insert before the streaming assistant message (last item)
                const rest = prev.slice(0, -1);
                const last = prev[prev.length - 1];
                return [...rest, toolItem, last];
              });
            } else if (payload.type === "tool_result") {
              setItems((prev) =>
                prev.map((item) =>
                  item.kind === "tool" && item.name === payload.name && !item.done
                    ? { ...item, done: true }
                    : item
                )
              );
            } else if (payload.type === "token") {
              setThinking(false);
              setItems((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.kind === "text" && last.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    content: last.content + payload.data,
                  };
                }
                return next;
              });
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setThinking(false);
      // AbortError = user stopped — keep the partial response, no error banner
      if (!(err instanceof Error && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setItems((prev) => prev.filter((item) => item.kind !== "tool" || item.done).slice(0, -1));
      }
    } finally {
      setThinking(false);
      setItems((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.kind === "text" && last.role === "assistant")
          next[next.length - 1] = { ...last, streaming: false };
        return next;
      });
      setBusy(false);
      textareaRef.current?.focus();
    }
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
          items.map((item) => <MessageRow key={item.id} item={item} />)
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
            placeholder="Ask Dream anything…"
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
        <p className="chat-footer-hint">
          Dream can make mistakes. Check important info.
        </p>
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
        const res = await fetch(`${API_URL}/voice/token`, { method: "POST" });
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
      await pub.unmute();
    }
    setMuted(next);
  }

  const statusLabel: Record<VoiceStatus, string> = {
    idle: "Starting…",
    connecting: "Connecting…",
    connected: "Listening",
    "agent-speaking": "Dream is speaking",
    error: errorMsg ?? "Error",
  };

  return (
    <div className="voice-shell">
      <div
        className={`voice-orb${status === "agent-speaking" ? " voice-orb-active" : ""}`}
      >
        <AssistantIcon />
      </div>
      <p className="voice-status">{statusLabel[status]}</p>
      {status !== "error" && status !== "idle" && (
        <button
          type="button"
          className={`voice-mic-btn${muted ? " voice-mic-muted" : ""}`}
          onClick={() => void toggleMute()}
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
