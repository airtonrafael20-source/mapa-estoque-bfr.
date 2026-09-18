"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

async function comprimirFundo(arquivo: File, largura = 1600): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, largura / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * escala;
  canvas.height = bitmap.height * escala;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

const TEMAS = [
  { valor: "", rotulo: "Nenhum (fundo liso)" },
  { valor: "/fundo-listras.jpg", rotulo: "Tema Botafogo — Listras" },
  { valor: "/fundo-estrela.jpg", rotulo: "Tema Botafogo — Estrela" },
];

export function useFundo() {
  const supabase = useRef(createClient()).current;
  const [fundo, setFundo] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("configuracoes")
      .select("fundo_base64")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setFundo((data?.fundo_base64 as string | null) ?? null);
      });
    return () => {
      ativo = false;
    };
  }, [supabase]);

  return fundo;
}

export default function TrocarFundo() {
  const supabase = useRef(createClient()).current;
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvarFundo(valor: string) {
    setEnviando(true);
    setErro(null);
    const { error } = await supabase
      .from("configuracoes")
      .update({ fundo_base64: valor || null, atualizado_em: new Date().toISOString() })
      .eq("id", 1);
    setEnviando(false);

    if (error) {
      setErro(
        'Não consegui salvar — falta rodar no Supabase: alter table configuracoes add column if not exists fundo_base64 text;'
      );
      return;
    }
    window.location.reload();
  }

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    try {
      const base64 = await comprimirFundo(arquivo);
      await salvarFundo(base64);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-ink-dim transition hover:border-accent hover:text-accent disabled:opacity-60"
      >
        🖼️ {enviando ? "Salvando…" : "Trocar fundo"}
      </button>

      {aberto && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg">
          {TEMAS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => {
                setAberto(false);
                salvarFundo(t.valor);
              }}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-ink-dim hover:bg-surface-2 hover:text-ink"
            >
              {t.rotulo}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              inputRef.current?.click();
            }}
            className="block w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-accent hover:bg-surface-2"
          >
            📁 Escolher minha foto…
          </button>
        </div>
      )}

      {erro && <p className="mt-2 text-[11px] leading-snug text-alert">{erro}</p>}

      <input ref={inputRef} type="file" accept="image/*" onChange={aoEscolherArquivo} className="hidden" />
    </div>
  );
}
