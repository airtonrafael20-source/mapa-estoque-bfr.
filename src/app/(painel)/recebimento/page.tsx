"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Posicao, descricaoProduto } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { beepErro, beepSucesso } from "@/lib/som";
import { useUI } from "@/components/ui-feedback";

export default function RecebimentoPage() {
  const { toast } = useUI();
  const [supabase] = useState(() => createClient());
  const [codigoBarras, setCodigoBarras] = useState("");
  const [posicoesEncontradas, setPosicoesEncontradas] = useState<Posicao[]>([]);
  const [posicaoEscolhida, setPosicaoEscolhida] = useState<Posicao | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [fornecedor, setFornecedor] = useState("");
  const [numeroNota, setNumeroNota] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recebidosHoje, setRecebidosHoje] = useState<{ produto: string; qtd: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [posicaoEscolhida]);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const codigo = codigoBarras.trim();
    if (!codigo) return;
    setBuscando(true);
    setErro(null);
    setPosicaoEscolhida(null);

    const { data } = await supabase
      .from("posicoes")
      .select("*")
      .eq("codigo_barras", codigo)
      .order("codigo_coluna", { ascending: true })
      .order("andar", { ascending: true });

    const encontradas = (data as Posicao[]) ?? [];
    setPosicoesEncontradas(encontradas);
    setBuscando(false);

    if (encontradas.length === 0) {
      beepErro();
      setErro("Nenhuma posição cadastrada com esse código de barras.");
    } else if (encontradas.length === 1) {
      beepSucesso();
      setPosicaoEscolhida(encontradas[0]);
    } else {
      beepSucesso();
    }
    setCodigoBarras("");
  }

  async function registrarNome(): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "Sem login";
    const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
    return perfil?.nome ?? user.email ?? "Usuário";
  }

  async function confirmarRecebimento() {
    if (!posicaoEscolhida) return;
    const qtd = Math.max(1, Number(quantidade) || 1);
    setSalvando(true);
    const nome = await registrarNome();
    const novaQtd = posicaoEscolhida.quantidade_atual + qtd;

    await supabase
      .from("posicoes")
      .update({ quantidade_atual: novaQtd, atualizado_em: new Date().toISOString() })
      .eq("id", posicaoEscolhida.id);

    await supabase.from("movimentacoes").insert({
      posicao_id: posicaoEscolhida.id,
      tipo: "entrada",
      quantidade: qtd,
      quantidade_resultante: novaQtd,
      responsavel_nome: nome,
      fornecedor: fornecedor.trim() || null,
      numero_nota: numeroNota.trim() || null,
    });

    setRecebidosHoje((prev) => [{ produto: descricaoProduto(posicaoEscolhida), qtd }, ...prev]);
    toast(`Recebido: ${qtd} — ${descricaoProduto(posicaoEscolhida)}`);
    setAviso(`Recebido: ${qtd} — ${descricaoProduto(posicaoEscolhida)}`);
    setTimeout(() => setAviso(null), 3000);

    setSalvando(false);
    setPosicaoEscolhida(null);
    setPosicoesEncontradas([]);
    setQuantidade("1");
  }

  const classeInput =
    "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent";

  return (
    <div>
      <PageHeader
        titulo="Recebimento de mercadoria"
        subtitulo="Bipa o produto que chegou, informa quantidade e fornecedor/nota — separado do ajuste do dia a dia."
      />

      <Card className="mb-4">
        <label className="mb-1.5 block text-sm text-ink-dim">Fornecedor (opcional, vale pra tudo que você bipar agora)</label>
        <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Mizuno" className={`${classeInput} mb-3`} />
        <label className="mb-1.5 block text-sm text-ink-dim">Nº da nota (opcional)</label>
        <input value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} placeholder="Ex.: 123456" className={classeInput} />
      </Card>

      {!posicaoEscolhida ? (
        <Card>
          <form onSubmit={buscar} className="flex gap-2">
            <input
              ref={inputRef}
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              placeholder="Bipe o código de barras…"
              autoComplete="off"
              className={classeInput}
            />
            <button
              type="submit"
              disabled={buscando}
              className="shrink-0 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-60"
            >
              {buscando ? "…" : "Buscar"}
            </button>
          </form>
          {erro && <p className="mt-3 text-sm text-alert">{erro}</p>}
          {aviso && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{aviso}</p>}

          {posicoesEncontradas.length > 1 && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-ink-dim">Esse código está em mais de uma posição — escolha uma:</p>
              {posicoesEncontradas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPosicaoEscolhida(p)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-sm text-ink hover:border-accent"
                >
                  {p.codigo_coluna} · andar {p.andar} — {descricaoProduto(p)}
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="text-center">
          {posicaoEscolhida.imagem_base64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posicaoEscolhida.imagem_base64}
              alt=""
              className="mx-auto mb-3 h-24 w-24 rounded-xl border border-border object-cover"
            />
          )}
          <p className="mb-1 font-display text-lg font-bold text-ink">{descricaoProduto(posicaoEscolhida)}</p>
          <p className="mb-4 text-sm text-ink-dim">
            {posicaoEscolhida.codigo_coluna} · andar {posicaoEscolhida.andar} — hoje tem {posicaoEscolhida.quantidade_atual}
          </p>

          <div className="mx-auto mb-4 flex max-w-xs items-center gap-2">
            <input
              type="number"
              min={1}
              autoFocus
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmarRecebimento()}
              className={`${classeInput} text-center text-lg`}
            />
          </div>

          <div className="mx-auto flex max-w-xs gap-2">
            <button
              onClick={() => {
                setPosicaoEscolhida(null);
                setPosicoesEncontradas([]);
              }}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm text-ink-dim"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarRecebimento}
              disabled={salvando}
              className="flex-1 rounded-lg bg-ok px-4 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "✔ Confirmar entrada"}
            </button>
          </div>
        </Card>
      )}

      {recebidosHoje.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-widest text-ink-dim">
            Recebidos nessa sessão
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {recebidosHoje.map((r, i) => (
              <li key={i}>
                +{r.qtd} — {r.produto}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
