"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Posicao,
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
  const [ajustando, setAjustando] = useState(false);
  const [quantidadeManual, setQuantidadeManual] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);

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

  async function registrarNome(): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "Sem login (QR)";
    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome")
      .eq("id", user.id)
      .maybeSingle();
    return perfil?.nome ?? user.email ?? "Usuário";
  }

  async function ajustar(delta: number, tipo: "retirada" | "reposicao") {
    if (!posicao || ajustando) return;

    const novaQtd = Math.max(0, Math.min(posicao.capacidade, posicao.quantidade_atual + delta));
    const confirmou = window.confirm(
      `Quantidade atual: ${posicao.quantidade_atual}\nNova quantidade: ${novaQtd}\n\nConfirma o ajuste?`
    );
    if (!confirmou) return;

    setAjustando(true);
    setMensagem(null);

    const nome = await registrarNome();

    await supabase
      .from("posicoes")
      .update({ quantidade_atual: novaQtd, atualizado_em: new Date().toISOString() })
      .eq("id", posicao.id);

    await supabase.from("movimentacoes").insert({
      posicao_id: posicao.id,
      tipo,
      quantidade: Math.abs(delta),
      quantidade_resultante: novaQtd,
      responsavel_nome: nome,
    });

    setPosicao({ ...posicao, quantidade_atual: novaQtd });
    setAjustando(false);
    setMensagem(tipo === "retirada" ? "Retirada registrada" : "Reposição registrada");
    setTimeout(() => setMensagem(null), 2000);
  }

  async function definirQuantidade() {
    if (!posicao || quantidadeManual === "") return;
    const valor = Math.max(0, Math.min(posicao.capacidade, Number(quantidadeManual)));
    const delta = valor - posicao.quantidade_atual;
    if (delta === 0) {
      setQuantidadeManual("");
      return;
    }

    const confirmou = window.confirm(
      `Quantidade atual: ${posicao.quantidade_atual}\nNova quantidade: ${valor}\n\nConfirma o ajuste?`
    );
    if (!confirmou) return;

    setAjustando(true);
    const nome = await registrarNome();

    await supabase
      .from("posicoes")
      .update({ quantidade_atual: valor, atualizado_em: new Date().toISOString() })
      .eq("id", posicao.id);

    await supabase.from("movimentacoes").insert({
      posicao_id: posicao.id,
      tipo: "ajuste",
      quantidade: Math.abs(delta),
      quantidade_resultante: valor,
      responsavel_nome: nome,
    });

    setPosicao({ ...posicao, quantidade_atual: valor });
    setQuantidadeManual("");
    setAjustando(false);
    setMensagem("Quantidade ajustada");
    setTimeout(() => setMensagem(null), 2000);
  }

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
      <h1 className="mb-1 max-w-sm break-words font-display text-2xl font-bold text-ink">
        {descricaoCompleta(posicao)}
      </h1>
      {posicao.codigo_barras && (
        <p className="mb-1 font-mono text-xs text-ink-dim">Cód. barras: {posicao.codigo_barras}</p>
      )}

      <div className="my-6">
        <span className="text-7xl" aria-hidden>
          {carinhaOcupacao(nivel)}
        </span>
      </div>

      <p className={`mb-1 font-display text-4xl font-bold ${CORES_TEXTO[nivel]}`}>
        {posicao.quantidade_atual}
        <span className="text-xl font-normal text-ink-dim"> / {posicao.capacidade}</span>
      </p>
      <p className="mb-8 text-sm text-ink-dim">peças nessa posição</p>

      <div className="mb-4 grid w-full max-w-xs grid-cols-2 gap-3">
        <button
          disabled={ajustando || posicao.quantidade_atual <= 0}
          onClick={() => ajustar(-1, "retirada")}
          className="rounded-xl bg-alert px-4 py-4 font-display text-lg font-bold text-white disabled:opacity-40"
        >
          − Retirar
        </button>
        <button
          disabled={ajustando || posicao.quantidade_atual >= posicao.capacidade}
          onClick={() => ajustar(1, "reposicao")}
          className="rounded-xl bg-ok px-4 py-4 font-display text-lg font-bold text-white disabled:opacity-40"
        >
          + Repor
        </button>
      </div>

      <div className="mb-2 flex w-full max-w-xs items-center gap-2">
        <input
          type="number"
          min={0}
          max={posicao.capacidade}
          value={quantidadeManual}
          onChange={(e) => setQuantidadeManual(e.target.value)}
          placeholder="Definir quantidade exata"
          className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-center text-ink outline-none focus:border-accent"
        />
        <button
          disabled={ajustando || quantidadeManual === ""}
          onClick={definirQuantidade}
          className="shrink-0 rounded-lg border border-accent px-4 py-2.5 font-semibold text-accent disabled:opacity-40"
        >
          OK
        </button>
      </div>

      {mensagem && <p className="mt-3 text-sm text-ok">{mensagem}</p>}

      <Link href="/" className="mt-10 text-sm text-ink-dim underline underline-offset-2">
        Abrir o mapa completo
      </Link>
    </main>
  );
}
