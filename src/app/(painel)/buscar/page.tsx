"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Posicao, carinhaOcupacao, descricaoProduto, nivelOcupacao } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

export default function BuscarPage() {
  const supabase = useMemo(() => createClient(), []);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data } = await supabase
        
        .from("posicoes")
        .select("*")
        .order("codigo_coluna", { ascending: true });
      if (ativo) {
        setPosicoes((data as Posicao[]) ?? []);
        setCarregando(false);
      }
    }
    carregar();

    const canal = supabase
      .channel("buscar-posicoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posicoes" }, () => carregar())
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [supabase]);

  const resultados = posicoes.filter((p) => {
    if (!busca.trim()) return false;
    const alvo = `${p.produto ?? ""} ${p.tamanho ?? ""} ${p.codigo_coluna}`.toLowerCase();
    return alvo.includes(busca.trim().toLowerCase());
  });

  return (
    <div>
      <PageHeader titulo="Buscar produto" subtitulo="Digite o nome do produto, tamanho ou a coluna." />

      <Card className="mb-4">
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex.: Mizuno 26/27 GG, ou A-1"
          className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-4 py-3 text-ink outline-none focus:border-accent"
        />
      </Card>

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando…</p>
      ) : !busca.trim() ? (
        <p className="text-sm text-ink-dim">Digite alguma coisa pra buscar.</p>
      ) : resultados.length === 0 ? (
        <Card>
          <p className="text-ink-dim">Nada encontrado pra &quot;{busca}&quot;.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {resultados.map((p) => {
            const nivel = nivelOcupacao(p);
            return (
              <Link
                key={p.id}
                href={`/posicao/${encodeURIComponent(p.codigo_coluna)}/${p.andar}`}
                className="block"
              >
                <Card className="flex flex-wrap items-center justify-between gap-3 transition hover:border-accent">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-ink">
                      {p.codigo_coluna} · Andar {p.andar}
                    </p>
                    <p className="truncate text-sm text-ink-dim">{descricaoProduto(p)}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-lg font-medium text-ink">
                    {p.quantidade_atual}/{p.capacidade} {carinhaOcupacao(nivel)}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
