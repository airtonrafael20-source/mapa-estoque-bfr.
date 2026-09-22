"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Posicao, carinhaOcupacao, descricaoProduto, nivelOcupacao } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

export default function AlertasPage() {
  const [supabase] = useState(() => createClient());
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const { data } = await supabase.from("posicoes").select("*");
      if (ativo) {
        setPosicoes((data as Posicao[]) ?? []);
        setCarregando(false);
      }
    }
    carregar();

    const canal = supabase
      .channel("alertas-posicoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posicoes" }, () => carregar())
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [supabase]);

  const criticos = useMemo(() => {
    return posicoes
      .filter((p) => p.produto)
      .filter((p) => {
        if (p.estoque_minimo !== null && p.estoque_minimo !== undefined) {
          return p.quantidade_atual <= p.estoque_minimo;
        }
        const nivel = nivelOcupacao(p);
        return nivel === "vazio" || nivel === "baixo";
      })
      .sort((a, b) => a.quantidade_atual - b.quantidade_atual);
  }, [posicoes]);

  function copiarParaWhatsapp() {
    const linhas = [
      "📋 *Alertas de estoque*",
      "",
      ...criticos.map(
        (p) =>
          `${carinhaOcupacao(nivelOcupacao(p))} ${p.codigo_coluna} · andar ${p.andar} — ${descricaoProduto(p)}: ${
            p.quantidade_atual
          }/${p.capacidade}`
      ),
    ];
    navigator.clipboard.writeText(linhas.join("\n")).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

  return (
    <div>
      <PageHeader
        titulo="Alertas"
        subtitulo="Posições vazias ou com estoque baixo (ou abaixo do mínimo que você definiu)."
        acao={
          criticos.length > 0 && (
            <button
              onClick={copiarParaWhatsapp}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110"
            >
              {copiado ? "✔ Copiado!" : "📋 Copiar lista pro WhatsApp"}
            </button>
          )
        }
      />

      <p className="mb-4 text-xs text-ink-dim">
        📩 Alerta automático (mandar sozinho por WhatsApp/e-mail) precisa de uma chave de API de um serviço de
        envio — quando tiver, me avisa que eu ligo aqui. Por enquanto, use o botão de copiar acima.
      </p>

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando…</p>
      ) : criticos.length === 0 ? (
        <Card>
          <p className="text-ok">✅ Nada crítico agora — tudo dentro do esperado.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="scroll-safe max-w-full">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-dim">
                  <th className="px-4 py-2.5 font-medium"></th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Posição</th>
                  <th className="px-4 py-2.5 font-medium">Produto</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {criticos.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-2.5 text-lg">{carinhaOcupacao(nivelOcupacao(p))}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink">
                      {p.codigo_coluna} · andar {p.andar}
                    </td>
                    <td className="px-4 py-2.5 text-ink">{descricaoProduto(p)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink">
                      {p.quantidade_atual} / {p.capacidade}
                    </td>
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
