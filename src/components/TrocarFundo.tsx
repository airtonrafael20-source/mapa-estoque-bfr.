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

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    try {
      const base64 = await comprimirFundo(arquivo);
      await supabase
        .from("configuracoes")
        .update({ fundo_base64: base64, atualizado_em: new Date().toISOString() })
        .eq("id", 1);
      window.location.reload();
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-ink-dim transition hover:border-accent hover:text-accent disabled:opacity-60"
      >
        🖼️ {enviando ? "Enviando…" : "Trocar fundo"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={aoEscolherArquivo} className="hidden" />
    </>
  );
}
