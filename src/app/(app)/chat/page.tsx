"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface ChatSummary {
  _id: string;
  title: string;
}

const EXAMPLE_PROMPTS = [
  "What’s my profit margin?",
  "What are my top 3 expenses?",
  "Are there any risks this month?",
  "Give me a business overview",
];

function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] whitespace-pre-wrap px-4 py-3 text-sm leading-6 ${
          isUser ? "rounded-2xl rounded-br-sm bg-[var(--primary)] text-[#07100c] shadow-[0_12px_30px_rgba(155,255,118,.1)]" : "rounded-2xl rounded-bl-sm border border-[rgba(155,255,118,.12)] bg-[rgba(155,255,118,.045)] text-[#dce8e0]"
        }`}
      >
        {msg.content.split("\n").map((line, i) =>
          line.trim().startsWith("- ") || line.trim().startsWith("* ") ? (
            <div key={i} className="flex gap-2">
              <span>·</span>
              <span>{renderText(line.trim().replace(/^[-*] /, ""))}</span>
            </div>
          ) : line.trim() === "" ? (
            <div key={i} className="h-2" />
          ) : (
            <div key={i}>{renderText(line)}</div>
          )
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch("/api/conversations", { cache: "no-store" });
      const d = await res.json();
      setConversations((d.conversations || []).map((c: ChatSummary) => ({ _id: c._id, title: c.title })));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConversations();
    setShowWelcome(localStorage.getItem("metrivo-chat-welcome") !== "seen");
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function newChat() {
    if (streaming) return;
    setActiveId(null);
    setMessages([]);
    setStatus(null);
    setTools([]);
    setError("");
  }

  async function openChat(id: string) {
    if (streaming || id === activeId) return;
    try {
      const res = await apiFetch(`/api/conversations/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load this chat");
      const d = await res.json();
      setMessages((d.messages || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })));
      setActiveId(id);
      setError("");
    } catch {
      setError("Could not load this chat.");
    }
  }

  async function deleteChat() {
    if (streaming) return;
    if (activeId) {
      await apiFetch(`/api/conversations/${activeId}`, { method: "DELETE" });
    }
    setConfirmDelete(false);
    newChat();
    loadConversations();
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError("");
    setStatus(null);
    setTools([]);
    setStreaming(true);
    setMessages((m) => [...m, { role: "user", content: text }]);

    try {
      const res = await apiFetch("/api/analyst/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: activeId || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "The analyst could not respond");
      }
      const newId = res.headers.get("X-Conversation-Id");
      if (!res.body) throw new Error("No response");

      let answer = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "status") setStatus(event.message);
          else if (event.type === "tool") setTools((t) => [...t, event.name]);
          else if (event.type === "delta") {
            setStatus(null);
            answer += event.content;
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: answer };
              return copy;
            });
          } else if (event.type === "error") setError(event.message);
        }
      }

      if (newId && !activeId) {
        setActiveId(newId);
        loadConversations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the analyst.");
    } finally {
      setStreaming(false);
      setStatus(null);
      setTools([]);
    }
  }

  function choosePrompt(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  function dismissWelcome() {
    localStorage.setItem("metrivo-chat-welcome", "seen");
    setShowWelcome(false);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-125px)] max-w-6xl gap-4">
      <aside className="card hidden w-64 shrink-0 flex-col p-3 md:flex">
        <button className="btn-primary mb-4 w-full" onClick={newChat} disabled={streaming}>
          + New chat
        </button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-neutral-400">No previous conversations.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c._id}
              onClick={() => openChat(c._id)}
              className={`block w-full truncate rounded-xl px-3 py-2.5 text-left text-xs transition ${
                c._id === activeId ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-slate-700 hover:bg-[rgba(255,255,255,.035)]"
              }`}
            >
              {c.title || "Untitled chat"}
            </button>
          ))}
        </div>
      </aside>

      <div className="card flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div><p className="auth-kicker">AI Analyst</p><p className="mt-1 text-xs text-neutral-500">Grounded in your business data · Online</p></div>
          {messages.length > 0 && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-danger min-h-8 px-2.5 py-1 text-xs"
            >
              Delete chat
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-[rgba(155,255,118,.12)] bg-[radial-gradient(circle_at_50%_10%,rgba(155,255,118,.1),transparent_45%),rgba(7,16,11,.52)] p-8 text-center">
              <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-[#07100c] shadow-[0_0_55px_rgba(155,255,118,.16)]">✦</div>
              {showWelcome ? (
                <>
                  <h2 className="mt-2 text-2xl">Ask the business.<br />Get an honest answer.</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                    I can analyze revenue, expenses, profit, cash flow, risks and opportunities using your business data.
                  </p>
                </>
              ) : (
                <>
                  <h2>What would you like to know?</h2>
                  <p className="mt-2 text-sm text-neutral-500">Try one of these questions or write your own.</p>
                </>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => choosePrompt(prompt)}
                    className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,.03)] px-3 py-2 text-xs text-slate-700 transition hover:border-[rgba(155,255,118,.3)] hover:text-[var(--primary)]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {showWelcome && (
                <button type="button" onClick={dismissWelcome} className="mt-4 text-xs text-[var(--primary)] hover:text-white">
                  Got it
                </button>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}
          {status && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:240ms]" />
              </span>
              {status}
            </div>
          )}
          {streaming && !status && messages[messages.length - 1]?.content === "" && (
            <div className="flex items-center gap-1" aria-label="Analyst is responding">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:240ms]" />
            </div>
          )}
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tools.map((t, i) => (
                <span key={i} className="rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-500">
                  {t.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
          {error && <div className="text-sm text-neutral-600">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-[var(--border)] bg-[rgba(3,12,7,.38)] p-4">
          <input
            ref={inputRef}
            className="input flex-1"
            placeholder="Ask a question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn-primary" disabled={streaming || !input.trim()}>
            Send
          </button>
        </form>
      </div>
      <ConfirmDialog open={confirmDelete} title="Delete this conversation?" description="This removes the current Analyst conversation and its saved history." confirmLabel="Delete conversation" onCancel={() => setConfirmDelete(false)} onConfirm={deleteChat} />
    </div>
  );
}
