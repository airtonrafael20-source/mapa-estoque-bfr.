"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { createClient } from "@/lib/supabase/client";
import { Posicao, descricaoCompleta } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

function EtiquetaImpressa({ p, qr }: { p: Posicao; qr: string | undefined }) {
  const barrasRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!barrasRef.current) return;
    if (!p.codigo_barras) return;

    // Limpa qualquer desenho anterior antes de gerar de novo — evita que o
    // código de barras seja desenhado em cima dele mesmo (o que faria as
    // barras se sobreporem e parecerem uma mancha escura em vez de linhas).
    while (barrasRef.current.firstChild) {
      barrasRef.current.removeChild(barrasRef.current.firstChild);
    }

    try {
      JsBarcode(barrasRef.current, p.codigo_barras, {
        format: "CODE128",
        width: 2.2,
        height: 55,
        displayValue: true,
        fontSize: 13,
        margin: 8,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      /* código inválido pro formato — ignora silenciosamente */
    }
  }, [p.codigo_barras]);

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center print:break-inside-avoid print:border-black print:bg-white print:p-4">
      <p className="font-display text-lg font-bold text-ink print:text-black">
        {p.codigo_coluna} · A{p.andar}
      </p>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`QR da posição ${p.codigo_coluna} andar ${p.andar}`} className="h-24 w-24" />
      )}
      <p className="line-clamp-2 text-xs text-ink-dim print:text-black">{descricaoCompleta(p)}</p>
      {p.codigo_barras ? (
        <svg ref={barrasRef} className="max-w-full" />
      ) : (
        <p className="text-[10px] text-ink-dim print:text-black">sem código de barras</p>
      )}
    </div>
  );
}

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
          subtitulo="Cada etiqueta sai com QR (abre a posição direto, sem precisar de login) e código de barras do produto."
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-2 print:gap-3">
        {posicoes.map((p) => (
          <EtiquetaImpressa key={p.id} p={p} qr={qrs[p.id]} />
        ))}
      </div>
    </div>
  );
}
