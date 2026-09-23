"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CORES_SUGERIDAS = ["#d4af17", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#0891b2"];

export default function OnboardingWizard() {
  const [supabase] = useState(() => createClient());
  const [fechado, setFechado] = useState(false);
  const [passo, setPasso] = useState(0);
  const [nomeApp, setNomeApp] = useState("Mapa de Estoque");
  const [subtituloApp, setSubtituloApp] = useState("");
  const [cor, setCor] = useState("#d4af17");
  const [nomeLocal, setNomeLocal] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (fechado) return null;

  async function concluir() {
    setSalvando(true);
    await supabase
      .from("configuracoes")
      .update({
        nome_app: nomeApp.trim() || "Mapa de Estoque",
        subtitulo_app: subtituloApp.trim() || null,
        cor_principal: cor,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", 1);

    if (nomeLocal.trim()) {
      await supabase.from("locais").insert({ nome: nomeLocal.trim() });
    }

    setSalvando(false);
    window.location.reload();
  }

  const passos = ["Nome do sistema", "Cor principal", "Primeiro local"];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg font-bold text-ink">👋 Bem-vindo! Vamos configurar</p>
          <button onClick={() => setFechado(true)} className="text-xs text-ink-dim underline underline-offset-2">
            Pular
          </button>
        </div>

        <div className="mb-5 flex gap-1.5">
          {passos.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= passo ? "bg-accent" : "bg-surface-2"}`} />
          ))}
        </div>

        {passo === 0 && (
          <div>
            <p className="mb-4 text-sm text-ink-dim">Como esse sistema vai se chamar?</p>
            <label className="mb-3 block">
              <span className="mb-1.5 block text-sm text-ink-dim">Nome principal</span>
              <input
                autoFocus
                value={nomeApp}
                onChange={(e) => setNomeApp(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="mb-5 block">
              <span className="mb-1.5 block text-sm text-ink-dim">Subtítulo / empresa (opcional)</span>
              <input
                value={subtituloApp}
                onChange={(e) => setSubtituloApp(e.target.value)}
                placeholder="Ex.: Nome da sua empresa"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
              />
            </label>
            <button onClick={() => setPasso(1)} className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink">
              Próximo
            </button>
          </div>
        )}

        {passo === 1 && (
          <div>
            <p className="mb-4 text-sm text-ink-dim">Escolhe a cor principal do sistema:</p>
            <div className="mb-5 flex flex-wrap gap-2">
              {CORES_SUGERIDAS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className="h-10 w-10 rounded-full border-2"
                  style={{ background: c, borderColor: cor === c ? "#fff" : "transparent" }}
                />
              ))}
              <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-full border-2 border-border bg-transparent" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPasso(0)} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-ink-dim">
                Voltar
              </button>
              <button onClick={() => setPasso(2)} className="flex-1 rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink">
                Próximo
              </button>
            </div>
          </div>
        )}

        {passo === 2 && (
          <div>
            <p className="mb-4 text-sm text-ink-dim">
              Qual o nome do primeiro local/galpão? (dá pra criar outros depois, em Gerenciar)
            </p>
            <input
              autoFocus
              value={nomeLocal}
              onChange={(e) => setNomeLocal(e.target.value)}
              placeholder="Ex.: Almoxarifado Central"
              className="mb-5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button onClick={() => setPasso(1)} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-ink-dim">
                Voltar
              </button>
              <button
                onClick={concluir}
                disabled={salvando}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-60"
              >
                {salvando ? "Salvando…" : "✔ Concluir"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
