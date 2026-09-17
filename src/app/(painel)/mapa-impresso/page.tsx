"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Local, Posicao, cestoLabel, compararColunas, descricaoProduto, ruaDaColuna } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import LogoUploader from "@/components/LogoUploader";

export default function MapaImpressoPage() {
  const supabase = useMemo(() => createClient(), []);
  const [locais, setLocais] = useState<Local[]>([]);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const [{ data: dLocais }, { data: dPos }] = await Promise.all([
        supabase.from("locais").select("*").order("criado_em", { ascending: true }),
        supabase
          .from("posicoes")
          .select("*")
          .order("codigo_coluna", { ascending: true })
          .order("andar", { ascending: true }),
      ]);
      if (ativo) {
        setLocais((dLocais as Local[]) ?? []);
        setPosicoes((dPos as Posicao[]) ?? []);
        setCarregando(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [supabase]);

  // Agrupa: local → rua → coluna → andares (tudo já ordenado corretamente)
  const estrutura = useMemo(() => {
    return locais.map((local) => {
      const posicoesDoLocal = posicoes
        .filter((p) => p.local_id === local.id)
        .sort((a, b) => compararColunas(a.codigo_coluna, b.codigo_coluna) || a.andar - b.andar);

      const colunasMap = new Map<string, Posicao[]>();
      for (const p of posicoesDoLocal) {
        if (!colunasMap.has(p.codigo_coluna)) colunasMap.set(p.codigo_coluna, []);
        colunasMap.get(p.codigo_coluna)!.push(p);
      }
      const colunas = Array.from(colunasMap.entries()).sort(([a], [b]) => compararColunas(a, b));

      const ruasMap = new Map<string, [string, Posicao[]][]>();
      for (const [codigo, itens] of colunas) {
        const rua = ruaDaColuna(codigo);
        if (!ruasMap.has(rua)) ruasMap.set(rua, []);
        ruasMap.get(rua)!.push([codigo, itens]);
      }
      const ruas = Array.from(ruasMap.entries()).sort(([a], [b]) => a.localeCompare(b));

      return { local, ruas, totalPosicoes: posicoesDoLocal.length };
    });
  }, [locais, posicoes]);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          titulo="Mapa impresso"
          subtitulo="Todos os endereços cadastrados, na ordem certa (A-1, A-2… até o fim). Pronto pra imprimir ou enviar."
          acao={
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink transition hover:brightness-110"
            >
              🖨 Imprimir
            </button>
          }
        />
        {carregando && <p className="text-sm text-ink-dim">Carregando…</p>}
      </div>

      {!carregando &&
        estrutura.map(({ local, ruas, totalPosicoes }) => (
          <div key={local.id} className="mb-10 print:break-after-page print:mb-0 last:print:break-after-auto">
            <header className="mb-4 flex items-center gap-3 border-b border-border pb-3 print:border-black">
              <LogoUploader tamanho={40} editavel={false} />
              <div className="min-w-0">
                <p className="font-display text-xs font-semibold uppercase tracking-widest text-accent print:text-black">
                  Mapa de estoque
                </p>
                <h2 className="font-display text-xl font-bold text-ink print:text-black">{local.nome}</h2>
                <p className="text-xs text-ink-dim print:text-black">
                  {totalPosicoes} posiç{totalPosicoes === 1 ? "ão" : "ões"} cadastrada
                  {totalPosicoes === 1 ? "" : "s"} · gerado em {new Date().toLocaleDateString("pt-BR")}
                </p>
              </div>
            </header>

            {ruas.length === 0 ? (
              <p className="text-sm text-ink-dim print:text-black">Nenhum endereço cadastrado nesse local ainda.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {ruas.map(([rua, colunas]) => (
                  <Card
                    key={rua}
                    className="print:break-inside-avoid print:rounded-none print:border-black print:bg-white"
                  >
                    <h3 className="mb-3 font-display text-base font-semibold tracking-wide text-ink print:text-black">
                      Rua {rua}
                    </h3>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
                      {colunas.map(([codigo, itens]) => {
                        const total = itens.reduce((s, p) => s + p.quantidade_atual, 0);
                        const capacidade = itens.reduce((s, p) => s + p.capacidade, 0);
                        return (
                          <div key={codigo} className="min-w-0 rounded-lg border border-border p-2.5 print:border-black">
                            <p className="mb-1 flex items-baseline justify-between gap-2 font-display text-sm font-semibold text-ink print:text-black">
                              <span>{cestoLabel(codigo) ?? codigo}</span>
                              <span className="text-xs font-normal text-ink-dim print:text-black">
                                {total}/{capacidade}
                              </span>
                            </p>
                            <ul className="flex flex-col gap-0.5">
                              {itens.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-baseline justify-between gap-2 text-xs text-ink-dim print:text-black"
                                >
                                  <span className="min-w-0 truncate">
                                    A{p.andar} · {descricaoProduto(p)}
                                  </span>
                                  <span className="shrink-0">{p.quantidade_atual}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
