"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Movimentacao, Posicao, descricaoProduto } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { baixarCsv } from "@/lib/csv";

interface MovComPosicao extends Movimentacao {
  posicoes: Posicao | null;
}

export default function GiroPage() {
  const [supabase] = useState(() => createClient());
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [movs, setMovs] = useState<MovComPosicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<"abc" | "parados">("abc");
  const [diasParado, setDiasParado] = useState("30");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const [{ data: dPos }, { data: dMov }] = await Promise.all([
        supabase.from("posicoes").select("*"),
        supabase.from("movimentacoes").select("*, posicoes(*)").order("criado_em", { ascending: false }).limit(2000),
      ]);
      if (ativo) {
        setPosicoes((dPos as Posicao[]) ?? []);
        setMovs((dMov as MovComPosicao[]) ?? []);
        setCarregando(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [supabase]);

  const curvaAbc = useMemo(() => {
    const totais = new Map<string, { rotulo: string; total: number }>();
    for (const m of movs) {
      if (m.tipo !== "retirada" || !m.posicoes) continue;
      const chave = `${m.posicoes.produto ?? "—"} · ${m.posicoes.tamanho ?? "—"}`;
      const atual = totais.get(chave);
      totais.set(chave, { rotulo: chave, total: (atual?.total ?? 0) + m.quantidade });
    }
    const lista = Array.from(totais.values()).sort((a, b) => b.total - a.total);
    const somaGeral = lista.reduce((s, x) => s + x.total, 0);
    let acumulado = 0;
    return lista.map((item) => {
      acumulado += item.total;
      const pctAcumulado = somaGeral > 0 ? (acumulado / somaGeral) * 100 : 0;
      const classe = pctAcumulado <= 80 ? "A" : pctAcumulado <= 95 ? "B" : "C";
      return { ...item, pctAcumulado: Math.round(pctAcumulado), classe };
    });
  }, [movs]);

  const parados = useMemo(() => {
    const limite = Math.max(1, Number(diasParado) || 30);
    const agora = Date.now();
    const ultimaMov = new Map<string, string>();
    for (const m of movs) {
      if (!ultimaMov.has(m.posicao_id)) ultimaMov.set(m.posicao_id, m.criado_em);
    }
    return posicoes
      .filter((p) => p.produto)
      .map((p) => {
        const ultima = ultimaMov.get(p.id);
        const dias = ultima ? Math.floor((agora - new Date(ultima).getTime()) / 86400000) : null;
        return { p, dias };
      })
      .filter((x) => x.dias === null || x.dias >= limite)
      .sort((a, b) => (b.dias ?? 99999) - (a.dias ?? 99999));
  }, [posicoes, movs, diasParado]);

  function exportarAbc() {
    baixarCsv(
      "curva-abc.csv",
      ["Produto", "Total retirado", "% acumulado", "Classe"],
      curvaAbc.map((i) => [i.rotulo, i.total, `${i.pctAcumulado}%`, i.classe])
    );
  }

  function exportarParados() {
    baixarCsv(
      "itens-parados.csv",
      ["Posição", "Andar", "Produto", "Tamanho", "Quantidade atual", "Dias sem mexer"],
      parados.map(({ p, dias }) => [p.codigo_coluna, p.andar, p.produto ?? "", p.tamanho ?? "", p.quantidade_atual, dias ?? "nunca"])
    );
  }

  const CORES_CLASSE: Record<string, string> = {
    A: "text-ok border-ok/40 bg-ok/10",
    B: "text-pend border-pend/40 bg-pend/10",
    C: "text-alert border-alert/40 bg-alert/10",
  };

  return (
    <div>
      <PageHeader titulo="Giro de estoque" subtitulo="O que vende rápido (curva ABC) e o que está parado." />

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setAba("abc")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === "abc" ? "bg-accent text-accent-ink" : "border border-border text-ink-dim"}`}
        >
          📈 Curva ABC
        </button>
        <button
          onClick={() => setAba("parados")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === "parados" ? "bg-accent text-accent-ink" : "border border-border text-ink-dim"}`}
        >
          🔍 Itens parados
        </button>
      </div>

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando…</p>
      ) : aba === "abc" ? (
        curvaAbc.length === 0 ? (
          <Card>
            <p className="text-ink-dim">Ainda não tem retiradas registradas pra calcular a curva.</p>
          </Card>
        ) : (
          <Card className="p-0">
            <div className="flex items-center justify-between px-4 pt-4">
              <p className="text-xs text-ink-dim">
                A = 80% do que mais sai · B = próximos 15% · C = os 5% mais parados
              </p>
              <button onClick={exportarAbc} className="text-xs font-semibold text-accent underline underline-offset-2">
                📄 Exportar CSV
              </button>
            </div>
            <div className="scroll-safe max-w-full">
              <table className="mt-3 w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-dim">
                    <th className="px-4 py-2.5 font-medium">Produto</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium">Total retirado</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium">% acumulado</th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium">Classe</th>
                  </tr>
                </thead>
                <tbody>
                  {curvaAbc.map((i) => (
                    <tr key={i.rotulo} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-ink">{i.rotulo}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink">{i.total}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-dim">{i.pctAcumulado}%</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${CORES_CLASSE[i.classe]}`}>
                          {i.classe}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        <>
          <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-dim">
              Parado há pelo menos
              <input
                type="number"
                min={1}
                value={diasParado}
                onChange={(e) => setDiasParado(e.target.value)}
                className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-center text-ink"
              />
              dias
            </label>
            <button onClick={exportarParados} className="text-xs font-semibold text-accent underline underline-offset-2">
              📄 Exportar CSV
            </button>
          </Card>
          {parados.length === 0 ? (
            <Card>
              <p className="text-ok">✅ Nada parado esse tanto de tempo.</p>
            </Card>
          ) : (
            <Card className="p-0">
              <div className="scroll-safe max-w-full">
                <table className="w-full min-w-[500px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-dim">
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Posição</th>
                      <th className="px-4 py-2.5 font-medium">Produto</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Qtd.</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Sem mexer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parados.map(({ p, dias }) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-ink">
                          {p.codigo_coluna} · andar {p.andar}
                        </td>
                        <td className="px-4 py-2.5 text-ink">{descricaoProduto(p)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-ink">{p.quantidade_atual}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-alert">
                          {dias === null ? "nunca mexeu" : `${dias} dias`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
