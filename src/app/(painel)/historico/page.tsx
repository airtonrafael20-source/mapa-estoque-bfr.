"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Movimentacao, Posicao, descricaoProduto } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { baixarCsv } from "@/lib/csv";

interface MovComPosicao extends Movimentacao {
  posicoes: Posicao | null;
}

const RUOTULO_TIPO: Record<string, string> = {
  retirada: "🔴 Retirada",
  reposicao: "🟢 Reposição",
  ajuste: "🟡 Ajuste",
  entrada: "📦 Entrada",
};

export default function HistoricoPage() {
  const [supabase] = useState(() => createClient());
  const [movs, setMovs] = useState<MovComPosicao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const { data } = await supabase
        .from("movimentacoes")
        .select("*, posicoes(*)")
        .order("criado_em", { ascending: false })
        .limit(500);
      if (ativo) {
        setMovs((data as MovComPosicao[]) ?? []);
        setCarregando(false);
      }
    }
    carregar();

    const canal = supabase
      .channel("historico-movimentacoes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "movimentacoes" }, () => carregar())
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [supabase]);

  const filtradas = useMemo(() => {
    return movs.filter((m) => {
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (filtroDe && m.criado_em < filtroDe) return false;
      if (filtroAte && m.criado_em > filtroAte + "T23:59:59") return false;
      if (filtroTexto.trim()) {
        const alvo = `${m.posicoes?.codigo_coluna ?? ""} ${m.posicoes?.produto ?? ""} ${m.responsavel_nome}`.toLowerCase();
        if (!alvo.includes(filtroTexto.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [movs, filtroTipo, filtroDe, filtroAte, filtroTexto]);

  function exportar() {
    baixarCsv(
      `historico-movimentacoes-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data/Hora", "Tipo", "Posição", "Andar", "Produto", "Tamanho", "Quantidade", "Resultante", "Responsável", "Fornecedor", "Nota"],
      filtradas.map((m) => [
        new Date(m.criado_em).toLocaleString("pt-BR"),
        m.tipo,
        m.posicoes?.codigo_coluna ?? "",
        m.posicoes?.andar ?? "",
        m.posicoes?.produto ?? "",
        m.posicoes?.tamanho ?? "",
        m.quantidade,
        m.quantidade_resultante,
        m.responsavel_nome,
        m.fornecedor ?? "",
        m.numero_nota ?? "",
      ])
    );
  }

  const classeInput =
    "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent";

  return (
    <div>
      <PageHeader
        titulo="Histórico de movimentações"
        subtitulo="Tudo que foi retirado, reposto, ajustado ou recebido — quem fez e quando."
        acao={
          <button
            onClick={exportar}
            className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent"
          >
            📄 Exportar CSV
          </button>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar posição, produto, pessoa…"
            className={`${classeInput} col-span-2 sm:col-span-1`}
          />
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={classeInput}>
            <option value="todos">Todos os tipos</option>
            <option value="retirada">Retirada</option>
            <option value="reposicao">Reposição</option>
            <option value="ajuste">Ajuste</option>
            <option value="entrada">Entrada</option>
          </select>
          <input type="date" value={filtroDe} onChange={(e) => setFiltroDe(e.target.value)} className={classeInput} />
          <input type="date" value={filtroAte} onChange={(e) => setFiltroAte(e.target.value)} className={classeInput} />
        </div>
      </Card>

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando…</p>
      ) : filtradas.length === 0 ? (
        <Card>
          <p className="text-ink-dim">Nenhuma movimentação encontrada com esse filtro.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="scroll-safe max-w-full">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-dim">
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Quando</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Posição / produto</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Qtd.</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Ficou</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Quem</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-dim">
                      {new Date(m.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink">{RUOTULO_TIPO[m.tipo] ?? m.tipo}</td>
                    <td className="px-4 py-2.5 text-ink">
                      {m.posicoes ? (
                        <>
                          <span className="font-semibold">{m.posicoes.codigo_coluna}</span> · andar {m.posicoes.andar} —{" "}
                          {descricaoProduto(m.posicoes)}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink">{m.quantidade}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-dim">{m.quantidade_resultante}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-dim">{m.responsavel_nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
