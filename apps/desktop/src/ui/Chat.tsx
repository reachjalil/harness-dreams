import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = "http://localhost:8000";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  { label: "Why was my alignment low?", sub: "Explain yesterday's score" },
  { label: "Find a session", sub: "Search my coding agent history" },
  { label: "What's my biggest friction?", sub: "Based on this week's logs" },
  { label: "How was my week?", sub: "Trend across the last 7 days" },
];

function AssistantIcon(): ReactElement {
  return (
    <div className="chat-ai-icon" aria-hidden="true">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="10" cy="10" r="7" />
        <path d="M7 10c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

function EmptyState({ onSuggest }: { onSuggest: (text: string) => void }): ReactElement {
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

function MessageRow({ msg }: { msg: Message }): ReactElement {
  if (msg.role === "user") {
    return (
      <div className="chat-row chat-row-user">
        <div className="chat-bubble-user">{msg.content}</div>
      </div>
    );
  }
  return (
    <div className="chat-row chat-row-assistant">
      <AssistantIcon />
      <div className="chat-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        {msg.streaming ? <span className="chat-cursor" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}

export default function Chat(): ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messageCount = messages.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageCount]);

  function autoResize(): void {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  async function send(text?: string): Promise<void> {
    const value = (text ?? input).trim();
    if (!value || busy) return;

    setInput("");
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: value };
    const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBusy(true);
    setThinking(true);

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
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
            if (payload.token) {
              setThinking(false);
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = { ...last, content: last.content + payload.token };
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
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setThinking(false);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, streaming: false };
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
    <div className="chat-shell">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <EmptyState onSuggest={(t) => void send(t)} />
        ) : (
          messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
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
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
          <button
            type="button"
            className={`chat-send-btn${busy ? " busy" : ""}`}
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            aria-label="Send"
          >
            {busy ? (
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="10" cy="10" r="7" strokeDasharray="4 2" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3l7 14-7-3.5L3 17l7-14z" />
              </svg>
            )}
          </button>
        </div>
        <p className="chat-footer-hint">Dream can make mistakes. Check important info.</p>
      </div>
    </div>
  );
}
