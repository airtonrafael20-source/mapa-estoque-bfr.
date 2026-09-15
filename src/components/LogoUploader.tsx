"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

async function comprimirImagem(arquivo: File, tamanho = 240): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const canvas = document.createElement("canvas");
  canvas.width = tamanho;
  canvas.height = tamanho;
  const ctx = canvas.getContext("2d")!;

  const escala = Math.max(tamanho / bitmap.width, tamanho / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (tamanho - w) / 2, (tamanho - h) / 2, w, h);

  return canvas.toDataURL("image/png", 0.9);
}

export function useLogo() {
  const supabase = useRef(createClient()).current;
  const [logo, setLogo] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("configuracoes")
      .select("logo_base64")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) {
          setLogo((data?.logo_base64 as string | null) ?? null);
          setCarregado(true);
        }
      });
    return () => {
      ativo = false;
    };
  }, [supabase]);

  return { logo, carregado };
}

export default function LogoUploader({
  tamanho = 40,
  editavel = true,
}: {
  tamanho?: number;
  editavel?: boolean;
}) {
  const supabase = useRef(createClient()).current;
  const { logo, carregado } = useLogo();
  const [logoLocal, setLogoLocal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (logo) setLogoLocal(logo);
  }, [logo]);

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setEnviando(true);
    try {
      const base64 = await comprimirImagem(arquivo);
      setLogoLocal(base64);
      await supabase
        .from("configuracoes")
        .update({ logo_base64: base64, atualizado_em: new Date().toISOString() })
        .eq("id", 1);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const imagemAtual = logoLocal ?? (carregado ? null : undefined);

  return (
    <button
      type="button"
      onClick={() => editavel && inputRef.current?.click()}
      disabled={!editavel}
      title={editavel ? "Clique para trocar a logo" : undefined}
      className="relative shrink-0 overflow-hidden rounded-full border-2 border-accent text-accent disabled:cursor-default"
      style={{ width: tamanho, height: tamanho }}
    >
      {imagemAtual ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagemAtual} alt="Logo" className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-display font-bold"
          style={{ fontSize: tamanho * 0.35 }}
        >
          BF
        </span>
      )}
      {enviando && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] text-white">
          …
        </span>
      )}
      {editavel && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={aoEscolherArquivo}
          className="hidden"
        />
      )}
    </button>
  );
}
