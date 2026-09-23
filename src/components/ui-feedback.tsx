"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface EstadoConfirm {
  tipo: "confirm";
  mensagem: string;
  perigoso?: boolean;
  resolver: (v: boolean) => void;
}
interface EstadoPrompt {
  tipo: "prompt";
  mensagem: string;
  valorInicial: string;
  resolver: (v: string | null) => void;
}
interface EstadoAlert {
  tipo: "alert";
  mensagem: string;
  resolver: () => void;
}
type EstadoModal = EstadoConfirm | EstadoPrompt | EstadoAlert | null;

interface Toast {
  id: number;
  mensagem: string;
  tipo: "sucesso" | "erro" | "info";
}

interface UIFeedback {
  confirmar: (mensagem: string, opts?: { perigoso?: boolean }) => Promise<boolean>;
  perguntar: (mensagem: string, valorInicial?: string) => Promise<string | null>;
  avisar: (mensagem: string) => Promise<void>;
  toast: (mensagem: string, tipo?: Toast["tipo"]) => void;
}

const Ctx = createContext<UIFeedback | null>(null);

export function useUI(): UIFeedback {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI precisa estar dentro de UIFeedbackProvider");
  return ctx;
}

export default function UIFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<EstadoModal>(null);
  const [valorPrompt, setValorPrompt] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const confirmar = useCallback((mensagem: string, opts?: { perigoso?: boolean }) => {
    return new Promise<boolean>((resolver) => {
      setModal({ tipo: "confirm", mensagem, perigoso: opts?.perigoso, resolver });
    });
  }, []);

  const perguntar = useCallback((mensagem: string, valorInicial = "") => {
    setValorPrompt(valorInicial);
    return new Promise<string | null>((resolver) => {
      setModal({ tipo: "prompt", mensagem, valorInicial, resolver });
    });
  }, []);

  const avisar = useCallback((mensagem: string) => {
    return new Promise<void>((resolver) => {
      setModal({ tipo: "alert", mensagem, resolver });
    });
  }, []);

  const toast = useCallback((mensagem: string, tipo: Toast["tipo"] = "sucesso") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  function fechar() {
    setModal(null);
  }

  const CORES_TOAST: Record<Toast["tipo"], string> = {
    sucesso: "border-ok/40 bg-ok/10 text-ok",
    erro: "border-alert/40 bg-alert/10 text-alert",
    info: "border-accent/40 bg-accent/10 text-accent",
  };

  return (
    <Ctx.Provider value={{ confirmar, perguntar, avisar, toast }}>
      {children}

      {/* Toasts — canto inferior direito, some sozinho */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-[toast-entrar_0.2s_ease-out] rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur ${CORES_TOAST[t.tipo]}`}
            style={{ background: "var(--surface)" }}
          >
            {t.mensagem}
          </div>
        ))}
      </div>

      {/* Modal — confirm / prompt / alert */}
      {modal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <p className="mb-4 whitespace-pre-line text-sm text-ink">{modal.mensagem}</p>

            {modal.tipo === "prompt" && (
              <input
                autoFocus
                value={valorPrompt}
                onChange={(e) => setValorPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    modal.resolver(valorPrompt);
                    fechar();
                  }
                }}
                className="mb-4 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-ink outline-none focus:border-accent"
              />
            )}

            <div className="flex justify-end gap-2">
              {modal.tipo === "confirm" && (
                <>
                  <button
                    onClick={() => {
                      modal.resolver(false);
                      fechar();
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-ink-dim"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      modal.resolver(true);
                      fechar();
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      modal.perigoso ? "bg-alert text-white" : "bg-accent text-accent-ink"
                    }`}
                  >
                    Confirmar
                  </button>
                </>
              )}
              {modal.tipo === "prompt" && (
                <>
                  <button
                    onClick={() => {
                      modal.resolver(null);
                      fechar();
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-ink-dim"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      modal.resolver(valorPrompt);
                      fechar();
                    }}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
                  >
                    OK
                  </button>
                </>
              )}
              {modal.tipo === "alert" && (
                <button
                  onClick={() => {
                    modal.resolver();
                    fechar();
                  }}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
