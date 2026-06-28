import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TextMessage {
  kind: "text";
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface StatusEvent {
  kind: "status";
  id: string;
  text: string;
}

type ChatItem = TextMessage | StatusEvent;

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

function StatusRow({ item }: { item: StatusEvent }): ReactElement {
  return (
    <div className="chat-row chat-row-assistant">
      <div className="chat-ai-icon-spacer" aria-hidden="true" />
      <p className="chat-status-line">{item.text}</p>
    </div>
  );
}

function MessageRow({ item }: { item: ChatItem }): ReactElement {
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

interface SessionSummary {
  sessionId: string;
  updatedAt: number;
  preview: string;
}

function HistoryPanel({
  onSelect,
  onClose,
}: {
  onSelect: (id: string) => void;
  onClose: () => void;
}): ReactElement {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.hd.chat
      .listSessions(50)
      .then((data) => setSessions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
    inputRef.current?.focus();
  }, []);

  const filtered = query.trim()
    ? sessions.filter((s) =>
        s.preview.toLowerCase().includes(query.trim().toLowerCase())
      )
    : sessions;

  function fmt(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0)
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <div className="chat-history-panel">
      <div className="chat-history-header">
        <span className="chat-history-title">History</span>
        <button
          type="button"
          className="chat-history-close"
          onClick={onClose}
          aria-label="Close history"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="chat-history-search-wrap">
        <svg
          aria-hidden="true"
          className="chat-history-search-icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="6.5" cy="6.5" r="4" />
          <path d="M11 11l3 3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="chat-history-search"
          placeholder="Search sessions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="chat-history-list">
        {loading && <p className="chat-history-empty">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="chat-history-empty">No sessions found.</p>
        )}
        {filtered.map((s) => (
          <button
            key={s.sessionId}
            type="button"
            className="chat-history-item"
            onClick={() => onSelect(s.sessionId)}
          >
            <span className="chat-history-preview">
              {s.preview || "Empty session"}
            </span>
            <span className="chat-history-time">{fmt(s.updatedAt)}</span>
          </button>
        ))}
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
  const [showHistory, setShowHistory] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to streaming chunks from main process
  useEffect(() => {
    const unsub = window.hd.chat.onChunk((chunk) => {
      if (chunk.type === "token") {
        setThinking(false);
        setItems((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.kind === "text" && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: last.content + chunk.data,
            };
          }
          return next;
        });
      } else if (chunk.type === "error") {
        setThinking(false);
        setError(chunk.message);
        setItems((prev) => prev.slice(0, -1));
        setBusy(false);
      } else if (chunk.type === "done") {
        sessionIdRef.current = chunk.sessionId;
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
    });
    return unsub;
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
    if (sessionIdRef.current) {
      void window.hd.chat.abort(sessionIdRef.current);
    }
    setThinking(false);
    setItems((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.kind === "text" && last.role === "assistant")
        next[next.length - 1] = { ...last, streaming: false };
      return next;
    });
    setBusy(false);
  }

  function loadSession(sid: string): void {
    window.hd.chat
      .getSession(sid)
      .then((doc) => {
        if (!doc?.messages?.length) return;
        const loaded: TextMessage[] = doc.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m, i) => ({
            kind: "text" as const,
            id: `loaded-${i}`,
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
        sessionIdRef.current = sid;
        setItems(loaded);
        setError(null);
      })
      .catch(() => {});
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

    const history = [...items, userItem]
      .filter((item): item is TextMessage => item.kind === "text")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      await window.hd.chat.send(history, sessionIdRef.current ?? undefined);
    } catch (err) {
      setThinking(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setItems((prev) => prev.slice(0, -1));
      setBusy(false);
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
      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          onSelect={(id) => {
            loadSession(id);
            setShowHistory(false);
          }}
        />
      )}
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
        <div className="chat-footer-row">
          <p className="chat-footer-hint">
            Dream can make mistakes. Check important info.
          </p>
          <div className="chat-footer-actions">
            <button
              type="button"
              className="chat-history-btn"
              onClick={() => setShowHistory((v) => !v)}
              aria-label="Chat history"
              title="Chat history"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <circle cx="10" cy="10" r="7" />
                <path
                  d="M10 6v4l2.5 2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {items.length > 0 && !busy && (
              <button
                type="button"
                className="chat-new-btn"
                onClick={() => {
                  sessionIdRef.current = null;
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
    </div>
  );
}

export default function Chat(): ReactElement {
  return (
    <div className="chat-shell">
      <TextChat />
    </div>
  );
}
