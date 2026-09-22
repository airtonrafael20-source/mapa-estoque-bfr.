"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Movimentacao, Posicao, descricaoProduto, nivelOcupacao } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

interface MovComPosicao extends Movimentacao {
  posicoes: Posicao | null;
}

export default function DashboardPage() {
  const [supabase] = useState(() => createClient());
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [movs, setMovs] = useState<MovComPosicao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const [{ data: dPos }, { data: dMov }] = await Promise.all([
        supabase.from("posicoes").select("*"),
        supabase.from("movimentacoes").select("*, posicoes(*)").order("criado_em", { ascending: false }).limit(12),
      ]);
      if (ativo) {
        setPosicoes((dPos as Posicao[]) ?? []);
        setMovs((dMov as MovComPosicao[]) ?? []);
        setCarregando(false);
      }
    }
    carregar();

    const canal = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posicoes" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, () => carregar())
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [supabase]);

  const numeros = useMemo(() => {
    const comProduto = posicoes.filter((p) => p.produto);
    const totalPecas = posicoes.reduce((s, p) => s + p.quantidade_atual, 0);
    const capacidadeTotal = posicoes.reduce((s, p) => s + p.capacidade, 0);
    const vazias = comProduto.filter((p) => nivelOcupacao(p) === "vazio").length;
    const baixas = comProduto.filter((p) => nivelOcupacao(p) === "baixo").length;
    return {
      totalPosicoes: posicoes.length,
      comProduto: comProduto.length,
      totalPecas,
      capacidadeTotal,
      vazias,
      baixas,
    };
  }, [posicoes]);

  const ranking = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const m of movs) {
      const nome = m.responsavel_nome.replace(/\s*\(inventário\)\s*/i, "").trim();
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
    return Array.from(contagem.entries()).sort((a, b) => b[1] - a[1]);
  }, [movs]);

  const RUOTULO_TIPO: Record<string, string> = {
    retirada: "🔴 retirou",
    reposicao: "🟢 repôs",
    ajuste: "🟡 ajustou",
    entrada: "📦 recebeu",
  };

  return (
    <div>
      <PageHeader titulo="Dashboard" subtitulo="O que está acontecendo no estoque agora." />

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando…</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="text-center">
              <p className="font-display text-3xl font-bold text-ink">{numeros.totalPecas}</p>
              <p className="text-xs text-ink-dim">peças / {numeros.capacidadeTotal} capacidade</p>
            </Card>
            <Card className="text-center">
              <p className="font-display text-3xl font-bold text-ink">{numeros.totalPosicoes}</p>
              <p className="text-xs text-ink-dim">posições cadastradas</p>
            </Card>
            <Link href="/alertas">
              <Card className="border-alert/40 text-center transition hover:brightness-110">
                <p className="font-display text-3xl font-bold text-alert">{numeros.vazias}</p>
                <p className="text-xs text-ink-dim">🔴😱 vazias</p>
              </Card>
            </Link>
            <Link href="/alertas">
              <Card className="border-pend/40 text-center transition hover:brightness-110">
                <p className="font-display text-3xl font-bold text-pend">{numeros.baixas}</p>
                <p className="text-xs text-ink-dim">🟠😟 baixas</p>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-display text-base font-semibold tracking-wide text-ink">
                ÚLTIMAS MOVIMENTAÇÕES
              </h2>
              {movs.length === 0 ? (
                <p className="text-sm text-ink-dim">Nenhuma movimentação ainda.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {movs.map((m) => (
                    <li key={m.id} className="border-b border-border pb-2 text-sm last:border-0">
                      <p className="text-ink">
                        {RUOTULO_TIPO[m.tipo] ?? m.tipo} {m.quantidade} em{" "}
                        <span className="font-semibold">{m.posicoes?.codigo_coluna ?? "—"}</span>
                        {m.posicoes && ` — ${descricaoProduto(m.posicoes)}`}
                      </p>
                      <p className="text-xs text-ink-dim">
                        {m.responsavel_nome} · {new Date(m.criado_em).toLocaleString("pt-BR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/historico" className="mt-3 inline-block text-xs text-accent underline underline-offset-2">
                Ver histórico completo
              </Link>
            </Card>

            <Card>
              <h2 className="mb-3 font-display text-base font-semibold tracking-wide text-ink">
                QUEM MAIS MEXEU (últimas {movs.length})
              </h2>
              {ranking.length === 0 ? (
                <p className="text-sm text-ink-dim">Sem dados ainda.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {ranking.map(([nome, qtd], i) => (
                    <li key={nome} className="flex items-center justify-between text-sm">
                      <span className="text-ink">
                        {i + 1}º {nome}
                      </span>
                      <span className="font-semibold text-accent">{qtd}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
