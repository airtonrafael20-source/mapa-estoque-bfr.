"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { Posicao, descricaoProduto } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

export default function EtiquetasPage() {
  const supabase = useMemo(() => createClient(), []);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data } = await supabase
        
        .from("posicoes")
        .select("*")
        .order("codigo_coluna", { ascending: true })
        .order("andar", { ascending: true });
      if (ativo) {
        setPosicoes((data as Posicao[]) ?? []);
        setCarregando(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!baseUrl || posicoes.length === 0) return;
    let ativo = true;
    async function gerar() {
      const entradas = await Promise.all(
        posicoes.map(async (p) => {
          const url = `${baseUrl}/posicao/${encodeURIComponent(p.codigo_coluna)}/${p.andar}`;
          const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
          return [p.id, dataUrl] as const;
        })
      );
      if (ativo) setQrs(Object.fromEntries(entradas));
    }
    gerar();
    return () => {
      ativo = false;
    };
  }, [baseUrl, posicoes]);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          titulo="Etiquetas / QR"
          subtitulo="Imprime, recorta e cola em cada cesto. Ao escanear, abre direto a posição pra ajustar a quantidade."
          acao={
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink transition hover:brightness-110"
            >
              🖨 Imprimir etiquetas
            </button>
          }
        />
        {carregando && <p className="text-sm text-ink-dim">Carregando posições…</p>}
        {!carregando && posicoes.length === 0 && (
          <Card>
            <p className="text-ink-dim">Cadastre posições em Gerenciar posições primeiro.</p>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
        {posicoes.map((p) => (
          <div
            key={p.id}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center print:break-inside-avoid print:border-black print:bg-white"
          >
            <p className="font-display text-lg font-bold text-ink print:text-black">
              {p.codigo_coluna} · A{p.andar}
            </p>
            {qrs[p.id] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrs[p.id]} alt={`QR code da posição ${p.codigo_coluna} andar ${p.andar}`} className="h-28 w-28" />
            )}
            <p className="line-clamp-2 text-xs text-ink-dim print:text-black">{descricaoProduto(p)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
