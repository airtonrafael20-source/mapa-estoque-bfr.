"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Posicao,
  calcularPicking,
  carinhaOcupacao,
  descricaoCompleta,
  nivelOcupacao,
} from "@/lib/types";

const CORES_TEXTO: Record<string, string> = {
  cheio: "text-ok",
  medio: "text-pend",
  baixo: "text-alert",
  vazio: "text-alert",
};

export default function PosicaoPage({
  params,
}: {
  params: Promise<{ coluna: string; andar: string }>;
}) {
  const { coluna, andar } = use(params);
  const codigoColuna = decodeURIComponent(coluna);
  const andarNum = Number(andar);

  const supabase = useMemo(() => createClient(), []);
  const [posicao, setPosicao] = useState<Posicao | null | undefined>(undefined);
  const [qtdSeparar, setQtdSeparar] = useState("1");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const { data } = await supabase
        .from("posicoes")
        .select("*")
        .eq("codigo_coluna", codigoColuna)
        .eq("andar", andarNum)
        .maybeSingle();
      if (ativo) setPosicao((data as Posicao) ?? null);
    }

    carregar();

    const canal = supabase
      .channel(`posicao-${codigoColuna}-${andarNum}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posicoes" },
        () => carregar()
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [supabase, codigoColuna, andarNum]);

  if (posicao === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-ink-dim">Carregando…</p>
      </main>
    );
  }

  if (posicao === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <span className="text-6xl" aria-hidden>❓</span>
        <h1 className="font-display text-2xl font-bold text-ink">
          Posição {codigoColuna} · andar {andarNum} não encontrada
        </h1>
        <p className="text-ink-dim">Ela pode ter sido removida ou renomeada.</p>
        <Link href="/gerenciar" className="mt-2 text-accent underline underline-offset-2">
          Cadastrar em Gerenciar posições
        </Link>
      </main>
    );
  }

  const nivel = nivelOcupacao(posicao);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-bg px-5 py-10 text-center">
      <p className="mb-1 font-display text-sm font-semibold uppercase tracking-widest text-accent">
        {posicao.codigo_coluna} · Andar {posicao.andar}
      </p>

      {posicao.imagem_base64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posicao.imagem_base64}
          alt={posicao.produto ?? "Produto"}
          className="mb-3 h-40 w-40 rounded-xl border border-border object-cover"
        />
      )}

      <h1 className="mb-1 max-w-sm break-words font-display text-2xl font-bold text-ink">
        {descricaoCompleta(posicao)}
      </h1>
      {posicao.codigo_barras && (
        <p className="mb-1 font-mono text-xs text-ink-dim">Cód. barras: {posicao.codigo_barras}</p>
      )}

      <div className="my-4">
        <span className="text-6xl" aria-hidden>
          {carinhaOcupacao(nivel)}
        </span>
      </div>

      <p className={`mb-1 font-display text-4xl font-bold ${CORES_TEXTO[nivel]}`}>
        {posicao.quantidade_atual}
        <span className="text-xl font-normal text-ink-dim"> / {posicao.capacidade}</span>
      </p>
      <p className="mb-8 text-sm text-ink-dim">peças nessa posição</p>

      {(posicao.peso_unitario_kg || posicao.distancia_metros) && (
        <div className="mb-6 w-full max-w-xs rounded-xl border border-border bg-surface-2 p-4 text-left">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
              📋 Tempo de separação
            </span>
            <input
              type="number"
              min={1}
              value={qtdSeparar}
              onChange={(e) => setQtdSeparar(e.target.value)}
              className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          {(() => {
            const r = calcularPicking({
              pesoUnitarioKg: posicao.peso_unitario_kg,
              distanciaMetros: posicao.distancia_metros,
              andar: posicao.andar,
              quantidade: Math.max(1, Number(qtdSeparar) || 1),
            });
            return (
              <>
                <p className="mb-1 text-sm text-ink">
                  ⏱️ <span className="font-semibold">{r.tempoTotalSeg}s</span> estimados · ⚖️{" "}
                  <span className="font-semibold">{r.pesoTotalKg}kg</span> no total
                </p>
                <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink-dim">
                  {r.alertas.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </>
            );
          })()}
        </div>
      )}

      <Link href="/" className="mt-4 text-sm text-ink-dim underline underline-offset-2">
        Abrir o mapa completo
      </Link>
    </main>
  );
}
