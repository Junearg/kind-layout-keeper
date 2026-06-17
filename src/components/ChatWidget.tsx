import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

const STORAGE_KEY = "fudo-cs-chat-v1";
const CHAT_ID = "fudo-cs-chat";

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  "¿Cuál es el país con peor NPS y qué pasa ahí?",
  "Dame las 3 cuentas más críticas de la cola",
  "¿Cómo evolucionó el churn entre Feb y Abr?",
  "¿Por qué el 52.1% de las bajas no tiene motivo?",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const initialMessages = useRef<UIMessage[]>(loadMessages());

  const { messages, sendMessage, status, setMessages } = useChat({
    id: CHAT_ID,
    messages: initialMessages.current,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err) => console.error("[chat]", err),
  });

  // Persist messages on every change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore quota errors */
    }
  }, [messages]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = async (msg: { text: string }) => {
    const text = msg.text.trim();
    if (!text || isLoading) return;
    await sendMessage({ text });
  };

  const handleClear = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleSuggestion = async (text: string) => {
    if (isLoading) return;
    await sendMessage({ text });
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          style={{
            position: "fixed", right: 24, bottom: 24, zIndex: 50,
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--orange)", color: "white", border: 0,
            boxShadow: "0 12px 28px rgba(240,90,40,0.35)",
            cursor: "pointer", display: "grid", placeItems: "center",
            fontFamily: "Instrument Serif, Georgia, serif",
            fontStyle: "italic", fontSize: 26,
          }}
        >
          f
        </button>
      )}

      {open && (
        <div
          style={{
            position: "fixed", right: 24, bottom: 24, zIndex: 50,
            width: 420, height: "min(640px, calc(100vh - 48px))",
            background: "var(--card)", borderRadius: 20,
            border: "1px solid var(--rule)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 16px", borderBottom: "1px solid var(--rule)",
            background: "var(--paper)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--orange)", display: "grid", placeItems: "center",
              color: "white", fontFamily: "Instrument Serif, Georgia, serif",
              fontStyle: "italic", fontSize: 18,
            }}>f</div>
            <div style={{ flex: 1 }}>
              <div className="strong" style={{ fontSize: 13.5, color: "var(--ink)" }}>Asistente Fudo</div>
              <div className="muted fs-11">pregunta sobre el dashboard</div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="muted fs-11"
                style={{ background: "transparent", border: 0, cursor: "pointer", padding: 4 }}
                aria-label="Borrar conversación"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              style={{
                width: 28, height: 28, borderRadius: 8, border: 0,
                background: "var(--paper-2)", cursor: "pointer",
                color: "var(--ink-2)", fontSize: 16, lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* Conversation */}
          <Conversation className="flex-1" style={{ background: "var(--paper)" }}>
            <ConversationContent>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  title="Preguntá lo que quieras"
                  description="Tengo acceso a todos los datos del dashboard: churn, NPS, health score, cola CS y KPIs."
                >
                  <div style={{ display: "grid", gap: 6, marginTop: 12, width: "100%" }}>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSuggestion(s)}
                        style={{
                          textAlign: "left", padding: "8px 12px",
                          background: "var(--card)", border: "1px solid var(--rule)",
                          borderRadius: 10, cursor: "pointer", fontSize: 12.5,
                          color: "var(--ink-2)", fontFamily: "inherit",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </ConversationEmptyState>
              ) : (
                messages.map((m) => {
                  const text = m.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join("");
                  if (m.role === "user") {
                    return (
                      <Message key={m.id} from="user">
                        <MessageContent
                          style={{
                            background: "var(--ink)",
                            color: "var(--paper)",
                          }}
                        >
                          {text}
                        </MessageContent>
                      </Message>
                    );
                  }
                  return (
                    <Message key={m.id} from="assistant">
                      <MessageContent style={{ background: "transparent", padding: 0, color: "var(--ink)" }}>
                        <MessageResponse>{text}</MessageResponse>
                      </MessageContent>
                    </Message>
                  );
                })
              )}
              {status === "submitted" && (
                <div style={{ padding: "6px 16px" }}>
                  <Shimmer>Pensando…</Shimmer>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Composer */}
          <div style={{ padding: 12, borderTop: "1px solid var(--rule)", background: "var(--card)" }}>
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="Preguntá sobre churn, NPS, cuentas…"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} disabled={isLoading} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      )}
    </>
  );
}
