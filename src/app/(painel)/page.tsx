"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  Posicao,
  carinhaOcupacao,
  cestoLabel,
  compararColunas,
  descricaoProduto,
  nivelOcupacao,
  ruaDaColuna,
} from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { baixarCsv } from "@/lib/csv";

const Mapa3DRua = dynamic(() => import("@/components/Mapa3DRua"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-xl border border-border bg-surface text-sm text-ink-dim">
      Carregando 3D…
    </div>
  ),
});

const CORES_NIVEL: Record<string, { borda: string; texto: string; barra: string }> = {
  cheio: { borda: "border-l-ok", texto: "text-ok", barra: "bg-ok" },
  medio: { borda: "border-l-pend", texto: "text-pend", barra: "bg-pend" },
  baixo: { borda: "border-l-alert", texto: "text-alert", barra: "bg-alert" },
  vazio: { borda: "border-l-border", texto: "text-ink-dim", barra: "bg-border" },
};

// Classes de borda completa (precisam existir por extenso no código pro Tailwind gerar).
const BORDA_CARD: Record<string, string> = {
  cheio: "border-ok",
  medio: "border-pend",
  baixo: "border-alert",
  vazio: "border-border",
};

// Do pior pro melhor — decide qual cor o card do endereço mostra (o andar mais crítico manda).
const ORDEM_GRAVIDADE: Record<string, number> = { vazio: 0, baixo: 1, medio: 2, cheio: 3 };

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
          <span className="font-semibold text-ink">C{p.andar}</span> · {descricaoProduto(p)}
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
  const [enderecoAberto, setEnderecoAberto] = useState<string | null>(null);
  const [ruaEm3D, setRuaEm3D] = useState<string | null>(null);

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
    return Array.from(mapa.entries()).sort(([a], [b]) => compararColunas(a, b));
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

  function exportarCsv() {
    baixarCsv(
      `estoque-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Endereço", "Andar", "Produto", "Tamanho", "Marca", "Ano", "Código de barras", "Quantidade", "Capacidade"],
      posicoes.map((p) => [
        p.codigo_coluna,
        p.andar,
        p.produto ?? "",
        p.tamanho ?? "",
        p.marca ?? "",
        p.ano ?? "",
        p.codigo_barras ?? "",
        p.quantidade_atual,
        p.capacidade,
      ])
    );
  }
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
      ) : enderecoAberto ? (
        (() => {
          const niveis = colunas.find(([codigo]) => codigo === enderecoAberto)?.[1] ?? [];
          const totalColuna = niveis.reduce((s, p) => s + p.quantidade_atual, 0);
          const capacidadeColuna = niveis.reduce((s, p) => s + p.capacidade, 0);
          return (
            <div>
              <button
                onClick={() => setEnderecoAberto(null)}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
              >
                ← Voltar pros endereços
              </button>
              <Card className="max-w-md">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <p className="font-display text-lg font-semibold tracking-wide text-ink">
                    {ruaDaColuna(enderecoAberto)}
                    {cestoLabel(enderecoAberto) && (
                      <span className="ml-1.5 text-accent">· {cestoLabel(enderecoAberto)}</span>
                    )}
                  </p>
                  <p className="text-sm text-ink-dim">
                    <span className="font-semibold text-ink">{totalColuna}</span> / {capacidadeColuna}
                  </p>
                </div>
                <div className="overflow-hidden rounded-b-md border border-t-0 border-border/60 pt-1">
                  {niveis.map((p) => (
                    <CestoNivel key={p.id} p={p} />
                  ))}
                </div>
              </Card>
            </div>
          );
        })()
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-alert/30 bg-alert/10 px-3 py-1 text-alert">
              🔴😱 {totalVazias} vazia{totalVazias === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-pend/30 bg-pend/10 px-3 py-1 text-pend">
              🟠😟 {totalBaixas} baixa{totalBaixas === 1 ? "" : "s"}
            </span>
            <Link
              href="/mapa-impresso"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent"
            >
              🖨 Imprimir mapa completo
            </Link>
            <button
              onClick={exportarCsv}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent"
            >
              📄 Exportar CSV
            </button>
          </div>

          <div className="flex flex-col gap-6">
            {ruas.map(([rua, colunasDaRua]) => (
              <div key={rua}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-ink-dim">
                    Rua {rua}
                  </h2>
                  <button
                    onClick={() => setRuaEm3D(ruaEm3D === rua ? null : rua)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      ruaEm3D === rua
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-accent/30 bg-accent/10 text-accent"
                    }`}
                  >
                    🧊 {ruaEm3D === rua ? "Fechar 3D" : "Ver em 3D"}
                  </button>
                </div>

                {ruaEm3D === rua && <Mapa3DRua colunas={colunasDaRua} />}

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {colunasDaRua.map(([codigo, niveis]) => {
                    const totalColuna = niveis.reduce((s, p) => s + p.quantidade_atual, 0);
                    const capacidadeColuna = niveis.reduce((s, p) => s + p.capacidade, 0);
                    const piorNivel = niveis
                      .map((p) => nivelOcupacao(p))
                      .sort((a, b) => ORDEM_GRAVIDADE[a] - ORDEM_GRAVIDADE[b])[0];
                    const cor = CORES_NIVEL[piorNivel];
                    const imagem = niveis.find((p) => p.imagem_base64)?.imagem_base64;
                    const tamanho = niveis.find((p) => p.tamanho)?.tamanho;
                    return (
                      <button
                        key={codigo}
                        onClick={() => setEnderecoAberto(codigo)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 bg-surface p-3 text-center transition hover:brightness-110 ${BORDA_CARD[piorNivel]}`}
                      >
                        {imagem ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imagem} alt="" className="h-12 w-12 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-xl">
                            📦
                          </span>
                        )}
                        <p className="font-display text-sm font-semibold text-ink">{cestoLabel(codigo) ?? codigo}</p>
                        {tamanho && (
                          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                            {tamanho}
                          </span>
                        )}
                        <p className={`text-xs font-medium ${cor.texto}`}>
                          {totalColuna}/{capacidadeColuna}
                        </p>
                      </button>
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
