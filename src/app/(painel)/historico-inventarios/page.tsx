"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Movimentacao, Posicao, descricaoProduto, ruaDaColuna } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

interface MovComPosicao extends Movimentacao {
  posicoes: Posicao | null;
}

interface Sessao {
  chave: string;
  data: string;
  endereco: string;
  responsavel: string;
  itens: MovComPosicao[];
}

export default function HistoricoInventariosPage() {
  const [supabase] = useState(() => createClient());
  const [movs, setMovs] = useState<MovComPosicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("movimentacoes")
      .select("*, posicoes(*)")
      .ilike("responsavel_nome", "%inventário%")
      .order("criado_em", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (ativo) {
          setMovs((data as MovComPosicao[]) ?? []);
          setCarregando(false);
        }
      });
    return () => {
      ativo = false;
    };
  }, [supabase]);

  const sessoes = useMemo(() => {
    const grupos = new Map<string, Sessao>();
    for (const m of movs) {
      if (!m.posicoes) continue;
      const dia = m.criado_em.slice(0, 10);
      const endereco = ruaDaColuna(m.posicoes.codigo_coluna);
      const chave = `${dia}__${endereco}__${m.responsavel_nome}`;
      if (!grupos.has(chave)) {
        grupos.set(chave, { chave, data: dia, endereco, responsavel: m.responsavel_nome, itens: [] });
      }
      grupos.get(chave)!.itens.push(m);
    }
    return Array.from(grupos.values()).sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [movs]);

  return (
    <div>
      <PageHeader
        titulo="Histórico de inventários"
        subtitulo="Cada contagem concluída, agrupada por dia e endereço — dá pra comparar a evolução."
      />

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando…</p>
      ) : sessoes.length === 0 ? (
        <Card>
          <p className="text-ink-dim">Nenhum inventário concluído ainda.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sessoes.map((s) => {
            const abertaAgora = aberta === s.chave;
            return (
              <Card key={s.chave} className="p-0">
                <button
                  onClick={() => setAberta(abertaAgora ? null : s.chave)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-ink">
                      {new Date(s.data + "T12:00:00").toLocaleDateString("pt-BR")} — {s.endereco}
                    </p>
                    <p className="text-xs text-ink-dim">
                      {s.itens.length} posiç{s.itens.length === 1 ? "ão" : "ões"} · {s.responsavel}
                    </p>
                  </div>
                  <span className="shrink-0 text-ink-dim">{abertaAgora ? "▲" : "▼"}</span>
                </button>
                {abertaAgora && (
                  <div className="border-t border-border px-4 py-3">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-ink-dim">
                          <th className="py-1.5 pr-3 font-medium">Andar</th>
                          <th className="py-1.5 pr-3 font-medium">Produto</th>
                          <th className="py-1.5 pr-3 font-medium">Ficou</th>
                          <th className="py-1.5 font-medium">Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.itens.map((m) => (
                          <tr key={m.id} className="border-b border-border last:border-0">
                            <td className="py-1.5 pr-3 text-ink">{m.posicoes?.andar}</td>
                            <td className="py-1.5 pr-3 text-ink">{m.posicoes ? descricaoProduto(m.posicoes) : "—"}</td>
                            <td className="py-1.5 pr-3 text-ink">{m.quantidade_resultante}</td>
                            <td className="py-1.5 text-xs text-ink-dim">
                              {new Date(m.criado_em).toLocaleTimeString("pt-BR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
