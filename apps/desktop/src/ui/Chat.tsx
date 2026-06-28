import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";

const API_URL = "http://localhost:8000";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

function MessageBubble({ msg }: { msg: Message }): ReactElement {
  return (
    <div className={`chat-msg chat-msg-${msg.role}`}>
      <div className="chat-msg-bubble">
        {msg.content}
        {msg.streaming ? <span className="chat-cursor" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}

function EmptyState(): ReactElement {
  const prompts = [
    "Why was my alignment score low yesterday?",
    "What's the one change that would help most tomorrow?",
    "Find the session where we discussed async patterns",
    "What was my implicit question on Wednesday?",
  ];
  return (
    <div className="chat-empty">
      <p className="chat-empty-title">Ask Dream anything about your sessions</p>
      <div className="chat-suggestions">
        {prompts.map((p) => (
          <span key={p} className="chat-suggestion">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Chat(): ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messageCount = messages.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messageCount]);

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setError(null);

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantMsg: Message = { id: `a-${Date.now()}`, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setBusy(true);

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

      if (!res.ok || !res.body) {
        throw new Error(`API error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.done) break;
            if (payload.error) throw new Error(payload.error);
            if (payload.token) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    content: last.content + payload.token,
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
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.slice(0, -1)); // remove the empty assistant bubble
    } finally {
      // Mark streaming done
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, streaming: false };
        }
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

  function clear(): void {
    if (busy) return;
    setMessages([]);
    setError(null);
  }

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <span className="chat-header-title">Dream</span>
        {messages.length > 0 && (
          <button
            type="button"
            className="chat-clear-btn"
            onClick={clear}
            disabled={busy}
          >
            Clear
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        {error && <p className="chat-error">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="Ask about your sessions…"
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
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
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
