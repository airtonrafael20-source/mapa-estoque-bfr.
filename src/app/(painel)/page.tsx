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

const CLASSES_NIVEL: Record<string, string> = {
  cheio: "border-ok/40 bg-ok/10",
  medio: "border-pend/40 bg-pend/10",
  baixo: "border-alert/40 bg-alert/10",
  vazio: "border-border bg-surface-2",
};

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

  return (
    <div>
      <PageHeader
        titulo="Mapa de estoque"
        subtitulo="Toque numa posição pra ver o produto e ajustar a quantidade."
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {colunasDaRua.map(([codigo, niveis]) => (
                    <Card key={codigo} className="p-3">
                      <p className="mb-2 px-1 font-display text-sm font-semibold tracking-wide text-ink">
                        {codigo}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {niveis.map((p) => {
                          const nivel = nivelOcupacao(p);
                          return (
                            <Link
                              key={p.id}
                              href={`/posicao/${encodeURIComponent(p.codigo_coluna)}/${p.andar}`}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs transition hover:brightness-110 ${CLASSES_NIVEL[nivel]}`}
                            >
                              <span className="min-w-0 flex-1 truncate text-ink">
                                <span className="text-ink-dim">A{p.andar}</span> · {descricaoProduto(p)}
                              </span>
                              <span className="shrink-0 whitespace-nowrap font-medium text-ink">
                                {p.quantidade_atual}/{p.capacidade} {carinhaOcupacao(nivel)}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
