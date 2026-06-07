"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ChatModel {
  id: string;
  name: string;
  externalId: string;
  provider: { displayName: string };
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  modelId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "modelmesh-chat-conversations";

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch { /* ignore */ }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser) {
    const text = firstUser.content.trim();
    return text.length > 40 ? text.slice(0, 40) + "..." : text;
  }
  return "New Chat";
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
}

function renderMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{renderInline(text.slice(lastIndex, match.index))}</span>);
    }
    const lang = match[1] || "text";
    const code = match[2].trimEnd();
    parts.push(
      <CodeBlock key={match.index} code={code} lang={lang} />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={lastIndex}>{renderInline(text.slice(lastIndex))}</span>);
  }

  if (parts.length === 0) {
    parts.push(<span key={0}>{renderInline(text)}</span>);
  }

  return parts;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    let processed = line
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1");

    const segments = processed.split(/([])/);
    let inBold = false;
    let inItalic = false;
    let inCode = false;
    const lineNodes: React.ReactNode[] = [];

    segments.forEach((seg, idx) => {
      if (seg === "") { inBold = !inBold; return; }
      if (seg === "") { inItalic = !inItalic; return; }
      if (seg === "") { inCode = !inCode; return; }
      if (inBold) {
        lineNodes.push(<strong key={idx}>{seg}</strong>);
      } else if (inItalic) {
        lineNodes.push(<em key={idx}>{seg}</em>);
      } else if (inCode) {
        lineNodes.push(<code key={idx} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{seg}</code>);
      } else {
        lineNodes.push(seg);
      }
    });

    nodes.push(<span key={i}>{lineNodes}</span>);
    if (i < lines.length - 1) nodes.push(<br key={`br-${i}`} />);
  });
  return nodes;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between bg-muted px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-mono">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="hover:text-foreground transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="bg-card p-3 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ChatClient({ models, apiKey }: { models: ChatModel[]; apiKey: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setConversations(loadConversations());
  }, []);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const selectedModel = activeConversation?.modelId ?? "auto";

  function createNewChat() {
    const newConv: Conversation = {
      id: generateId(),
      title: "New Chat",
      modelId: "auto",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
    setInput("");
  }

  function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function updateConversation(id: string, updater: (c: Conversation) => Conversation) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? updater(c) : c))
    );
  }

  async function handleSend() {
    if (!input.trim() || !activeId || isLoading) return;

    const userMsg: Message = { role: "user", content: input.trim() };

    updateConversation(activeId, (c) => {
      const updated = {
        ...c,
        messages: [...c.messages, userMsg],
        title: c.title === "New Chat" ? extractTitle([...c.messages, userMsg]) : c.title,
        updatedAt: Date.now(),
      };
      return updated;
    });

    setInput("");
    setIsLoading(true);

    const conv = conversations.find((c) => c.id === activeId);
    const modelId = conv?.modelId;
    const model = modelId && modelId !== "auto" ? models.find((m) => m.id === modelId) : null;
    try {
      const res = await fetch("/api/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model ? model.externalId : "auto",
          messages: [
            { role: "system", content: systemPrompt },
            ...(conv?.messages ?? []),
            userMsg,
          ],
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown error");
        updateConversation(activeId, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: `Error: ${res.status} ${err}` }],
          updatedAt: Date.now(),
        }));
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        updateConversation(activeId, (c) => ({
          ...c,
          messages: [...c.messages, { role: "assistant", content: "Error: No response body" }],
          updatedAt: Date.now(),
        }));
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let assistantContent = "";

      updateConversation(activeId, (c) => ({
        ...c,
        messages: [...c.messages, { role: "assistant", content: "" }],
        updatedAt: Date.now(),
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              updateConversation(activeId, (c) => {
                const msgs = [...c.messages];
                msgs[msgs.length - 1] = { role: "assistant", content: assistantContent };
                return { ...c, messages: msgs, updatedAt: Date.now() };
              });
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }
    } catch (e) {
      updateConversation(activeId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Request failed"}` },
        ],
        updatedAt: Date.now(),
      }));
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  // Auto-create first chat if none exists
  useEffect(() => {
    if (conversations.length === 0 && models.length > 0) {
      createNewChat();
    }
  }, [conversations.length, models.length]);

  const messages = activeConversation?.messages ?? [];

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } flex-shrink-0 border-r border-border bg-card transition-all duration-200 overflow-hidden flex flex-col`}
      >
        <div className="p-3 border-b border-border">
          <Button onClick={createNewChat} className="w-full" size="sm">
            + New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No chats yet</p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveId(conv.id)}
              className={`group relative rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                conv.id === activeId
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="truncate flex-1">{conv.title}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] opacity-50">{formatDate(conv.updatedAt)} · {formatTime(conv.updatedAt)}</span>
                <button
                  onClick={(e) => deleteChat(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                  title="Delete chat"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 flex-1">
            <select
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={selectedModel}
              onChange={(e) => {
                if (activeId) {
                  updateConversation(activeId, (c) => ({ ...c, modelId: e.target.value }));
                }
              }}
            >
              <option value="auto">Auto (Router decides)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider.displayName})
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSystemPrompt((v) => !v)}
          >
            {showSystemPrompt ? "Hide Prompt" : "System Prompt"}
          </Button>
        </div>

        {showSystemPrompt && (
          <div className="border-b border-border px-4 py-2 bg-muted/50">
            <label className="text-xs font-medium text-muted-foreground block mb-1">System Prompt</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[48px] resize-y"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-sm">How can I help you today?</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role !== "user" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              ref={textareaRef}
              className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[52px] max-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="self-end rounded-xl h-[52px] w-[52px] p-0 flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1">
            Shift+Enter for new line · Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
