"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Posicao,
  carinhaOcupacao,
  descricaoProduto,
  nivelOcupacao,
  ruaDaColuna,
} from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

const CORES_NIVEL: Record<string, { borda: string; texto: string; barra: string }> = {
  cheio: { borda: "border-l-ok", texto: "text-ok", barra: "bg-ok" },
  medio: { borda: "border-l-pend", texto: "text-pend", barra: "bg-pend" },
  baixo: { borda: "border-l-alert", texto: "text-alert", barra: "bg-alert" },
  vazio: { borda: "border-l-border", texto: "text-ink-dim", barra: "bg-border" },
};

/** Um "andar" desenhado como cesto empilhável de verdade — trapézio, textura de tela. */
function CestoNivel({ p }: { p: Posicao }) {
  const nivel = nivelOcupacao(p);
  const cor = CORES_NIVEL[nivel];
  const pct = p.capacidade > 0 ? Math.min(100, Math.round((p.quantidade_atual / p.capacidade) * 100)) : 0;

  return (
    <Link
      href={`/posicao/${encodeURIComponent(p.codigo_coluna)}/${p.andar}`}
      className={`group relative -mt-1 block border-l-4 px-3 py-2 text-xs transition first:mt-0 hover:z-10 hover:brightness-125 ${cor.borda}`}
      style={{
        clipPath: "polygon(3% 100%, 97% 100%, 100% 0%, 0% 0%)",
        background:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 2px, rgba(0,0,0,0) 2px 9px), #232326",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-ink-dim">
          <span className="font-semibold text-ink">A{p.andar}</span> · {descricaoProduto(p)}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {p.imagem_base64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem_base64} alt="" className="h-5 w-5 rounded object-cover" />
          )}
          <span className={`whitespace-nowrap font-semibold ${cor.texto}`}>
            {p.quantidade_atual}/{p.capacidade} {carinhaOcupacao(nivel)}
          </span>
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/40">
        <div className={`h-full ${cor.barra}`} style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </Link>
  );
}

export default function MapaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [carregando, setCarregando] = useState(true);

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

    const canal = supabase
      .channel("mapa-posicoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posicoes" }, () => carregar())
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [supabase]);

  const colunas = useMemo(() => {
    const mapa = new Map<string, Posicao[]>();
    for (const p of posicoes) {
      if (!mapa.has(p.codigo_coluna)) mapa.set(p.codigo_coluna, []);
      mapa.get(p.codigo_coluna)!.push(p);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.andar - b.andar);
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [posicoes]);

  const ruas = useMemo(() => {
    const mapa = new Map<string, [string, Posicao[]][]>();
    for (const [codigo, itens] of colunas) {
      const rua = ruaDaColuna(codigo);
      if (!mapa.has(rua)) mapa.set(rua, []);
      mapa.get(rua)!.push([codigo, itens]);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [colunas]);

  const totalVazias = posicoes.filter((p) => nivelOcupacao(p) === "vazio").length;
  const totalBaixas = posicoes.filter((p) => nivelOcupacao(p) === "baixo").length;
  const totalGeral = posicoes.reduce((s, p) => s + p.quantidade_atual, 0);
  const capacidadeGeral = posicoes.reduce((s, p) => s + p.capacidade, 0);

  return (
    <div>
      <PageHeader
        titulo="Mapa de estoque"
        subtitulo="Toque numa posição pra ver o produto e ajustar a quantidade."
        acao={
          <Card className="px-5 py-3 text-right">
            <p className="text-xs text-ink-dim">Total geral</p>
            <p className="font-display text-2xl font-bold text-ink">
              {totalGeral}
              <span className="text-sm font-normal text-ink-dim"> / {capacidadeGeral} peças</span>
            </p>
          </Card>
        }
      />

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando mapa…</p>
      ) : colunas.length === 0 ? (
        <Card>
          <p className="text-ink-dim">
            Nenhuma posição cadastrada ainda. Comece em{" "}
            <Link href="/gerenciar" className="text-accent underline underline-offset-2">
              Gerenciar posições
            </Link>
            .
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-alert/30 bg-alert/10 px-3 py-1 text-alert">
              🔴😱 {totalVazias} vazia{totalVazias === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-pend/30 bg-pend/10 px-3 py-1 text-pend">
              🟠😟 {totalBaixas} baixa{totalBaixas === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-col gap-6">
            {ruas.map(([rua, colunasDaRua]) => (
              <div key={rua}>
                <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-ink-dim">
                  Rua {rua}
                </h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {colunasDaRua.map(([codigo, niveis]) => {
                    const totalColuna = niveis.reduce((s, p) => s + p.quantidade_atual, 0);
                    const capacidadeColuna = niveis.reduce((s, p) => s + p.capacidade, 0);
                    return (
                      <div key={codigo}>
                        <div className="mb-1.5 flex items-baseline justify-between px-1">
                          <p className="font-display text-sm font-semibold tracking-wide text-ink">
                            {codigo}
                          </p>
                          <p className="text-xs text-ink-dim">
                            <span className="font-semibold text-ink">{totalColuna}</span> / {capacidadeColuna}
                          </p>
                        </div>
                        <div className="overflow-hidden rounded-b-md border border-t-0 border-border/60 pt-1">
                          {niveis.map((p) => (
                            <CestoNivel key={p.id} p={p} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
