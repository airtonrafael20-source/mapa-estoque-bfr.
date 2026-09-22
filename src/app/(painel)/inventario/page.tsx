"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Local, Posicao, compararColunas, descricaoProduto } from "@/lib/types";
import { beepErro, beepSucesso } from "@/lib/som";
import { Card, PageHeader } from "@/components/ui";

export default function InventarioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [locais, setLocais] = useState<Local[]>([]);
  const [localAtivoId, setLocalAtivoId] = useState("");
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [enderecoEscolhido, setEnderecoEscolhido] = useState("");
  const [inventariando, setInventariando] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0); // índice dentro dos andares do endereço
  const [contagem, setContagem] = useState(0);
  const [concluidos, setConcluidos] = useState<{ andar: number; antes: number; depois: number }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [entradaBip, setEntradaBip] = useState("");
  const [avisoBip, setAvisoBip] = useState<string | null>(null);
  const [ajusteManual, setAjusteManual] = useState(false);
  const [conferenciaDupla, setConferenciaDupla] = useState(false);
  const [primeiraContagem, setPrimeiraContagem] = useState<number | null>(null);
  const [avisoDupla, setAvisoDupla] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const [{ data: dLocais }, { data: dPos }] = await Promise.all([
        supabase.from("locais").select("*").order("criado_em", { ascending: true }),
        supabase.from("posicoes").select("*"),
      ]);
      if (ativo) {
        const listaLocais = (dLocais as Local[]) ?? [];
        setLocais(listaLocais);
        setLocalAtivoId((atual) => atual || listaLocais[0]?.id || "");
        setPosicoes((dPos as Posicao[]) ?? []);
        setCarregando(false);
      }
    }
    carregar();

    const canal = supabase
      .channel("inventario-posicoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posicoes" }, () => carregar())
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [supabase]);

  const enderecosDisponiveis = useMemo(() => {
    const codigos = Array.from(
      new Set(posicoes.filter((p) => p.local_id === localAtivoId).map((p) => p.codigo_coluna))
    );
    return codigos.sort(compararColunas);
  }, [posicoes, localAtivoId]);

  const andaresDoEndereco = useMemo(() => {
    return posicoes
      .filter((p) => p.local_id === localAtivoId && p.codigo_coluna === enderecoEscolhido)
      .sort((a, b) => a.andar - b.andar);
  }, [posicoes, localAtivoId, enderecoEscolhido]);

  const posicaoAtual = andaresDoEndereco[passoAtual];
  const terminouEndereco = inventariando && passoAtual >= andaresDoEndereco.length;
  const inputBipRef = useRef<HTMLInputElement>(null);

  // O campo de bipagem fica sempre focado — é ele que recebe tudo que o
  // leitor "digitar", pra nunca cair sem querer num campo de número.
  useEffect(() => {
    if (!ajusteManual) inputBipRef.current?.focus();
  }, [ajusteManual, passoAtual, terminouEndereco]);

  function aoBiparUnidade(e: React.FormEvent) {
    e.preventDefault();
    const codigo = entradaBip.trim();
    setEntradaBip("");
    if (!codigo || !posicaoAtual) return;

    if (posicaoAtual.codigo_barras && codigo !== posicaoAtual.codigo_barras) {
      beepErro();
      setAvisoBip(`Esse código não é dessa posição (esperado: ${posicaoAtual.codigo_barras}).`);
      setTimeout(() => setAvisoBip(null), 2500);
      return;
    }

    beepSucesso();
    setAvisoBip(null);
    setContagem((atual) => atual + 1);
  }

  function iniciarInventario() {
    if (!enderecoEscolhido) return;
    setPassoAtual(0);
    setContagem(0);
    setConcluidos([]);
    setAjusteManual(false);
    setEntradaBip("");
    setPrimeiraContagem(null);
    setAvisoDupla(null);
    setInventariando(true);
  }

  function encerrarInventario() {
    setInventariando(false);
    setEnderecoEscolhido("");
    setConcluidos([]);
    setPrimeiraContagem(null);
    setAvisoDupla(null);
  }

  async function registrarNome(): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "Sem login";
    const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
    return perfil?.nome ?? user.email ?? "Usuário";
  }

  async function salvarContagemFinal(valor: number) {
    if (!posicaoAtual) return;
    setSalvando(true);

    if (valor !== posicaoAtual.quantidade_atual) {
      const nome = await registrarNome();
      await supabase
        .from("posicoes")
        .update({ quantidade_atual: valor, atualizado_em: new Date().toISOString() })
        .eq("id", posicaoAtual.id);
      await supabase.from("movimentacoes").insert({
        posicao_id: posicaoAtual.id,
        tipo: "ajuste",
        quantidade: Math.abs(valor - posicaoAtual.quantidade_atual),
        quantidade_resultante: valor,
        responsavel_nome: `${nome} (inventário)`,
      });
      setPosicoes((prev) => prev.map((p) => (p.id === posicaoAtual.id ? { ...p, quantidade_atual: valor } : p)));
    }

    setConcluidos((prev) => [...prev, { andar: posicaoAtual.andar, antes: posicaoAtual.quantidade_atual, depois: valor }]);
    setSalvando(false);
    setContagem(0);
    setAjusteManual(false);
    setEntradaBip("");
    setPrimeiraContagem(null);
    setAvisoDupla(null);
    setPassoAtual((p) => p + 1);
  }

  async function confirmarAndar() {
    if (!posicaoAtual) return;
    const valor = Math.max(0, contagem);

    if (!conferenciaDupla) {
      await salvarContagemFinal(valor);
      return;
    }

    // Conferência em dupla: a primeira confirmação só guarda o número e
    // pede pra contar de novo; só salva quando as duas baterem.
    if (primeiraContagem === null) {
      setPrimeiraContagem(valor);
      setContagem(0);
      setAjusteManual(false);
      setEntradaBip("");
      setAvisoDupla(`1ª contagem: ${valor}. Agora conte de novo, do zero, pra confirmar.`);
      return;
    }

    if (valor === primeiraContagem) {
      await salvarContagemFinal(valor);
    } else {
      setAvisoDupla(
        `⚠️ As duas contagens não bateram (1ª: ${primeiraContagem}, 2ª: ${valor}). Recontando do zero — bipe/digite com calma.`
      );
      setPrimeiraContagem(null);
      setContagem(0);
      setAjusteManual(false);
      setEntradaBip("");
    }
  }

  const classeInput =
    "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent";

  return (
    <div>
      <PageHeader
        titulo="Inventário"
        subtitulo="Escolha um endereço, inicie, e bipe cada peça daquele cesto — o total soma sozinho e já vai pro sistema."
      />

      {!inventariando ? (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-sm text-ink-dim">Local / galpão</span>
              <select value={localAtivoId} onChange={(e) => setLocalAtivoId(e.target.value)} className={classeInput}>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-sm text-ink-dim">Endereço (coluna)</span>
              <select value={enderecoEscolhido} onChange={(e) => setEnderecoEscolhido(e.target.value)} className={classeInput}>
                <option value="">Selecione…</option>
                {enderecosDisponiveis.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={iniciarInventario}
              disabled={!enderecoEscolhido || carregando}
              className="shrink-0 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
            >
              ▶ Iniciar inventário
            </button>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-ink-dim">
            <input
              type="checkbox"
              checked={conferenciaDupla}
              onChange={(e) => setConferenciaDupla(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            👥 Conferência em dupla (conta duas vezes cada cesto pra evitar erro)
          </label>
        </Card>
      ) : (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <p className="font-display text-lg font-semibold text-ink">Endereço {enderecoEscolhido}</p>
            <button onClick={encerrarInventario} className="text-sm text-ink-dim underline underline-offset-2">
              Encerrar
            </button>
          </div>

          {!terminouEndereco && posicaoAtual ? (
            <div className="text-center">
              <p className="mb-1 text-sm text-ink-dim">
                Cesto {passoAtual + 1} de {andaresDoEndereco.length} (andar {posicaoAtual.andar})
              </p>
              {posicaoAtual.imagem_base64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={posicaoAtual.imagem_base64}
                  alt=""
                  className="mx-auto mb-3 h-24 w-24 rounded-xl border border-border object-cover"
                />
              )}
              <p className="mb-1 font-display text-lg font-bold text-ink">{descricaoProduto(posicaoAtual)}</p>
              <p className="mb-5 text-xs text-ink-dim">
                Sistema tinha {posicaoAtual.quantidade_atual} · capacidade {posicaoAtual.capacidade}
              </p>

              {/* Contador grande — sobe sozinho a cada bipada */}
              <div className="mx-auto mb-2 flex max-w-xs items-center justify-center gap-4">
                <button
                  onClick={() => setContagem((c) => Math.max(0, c - 1))}
                  className="h-11 w-11 shrink-0 rounded-lg border border-border text-xl text-ink-dim"
                >
                  −
                </button>
                <span className="font-display text-5xl font-bold text-accent">{contagem}</span>
                <button
                  onClick={() => setContagem((c) => c + 1)}
                  className="h-11 w-11 shrink-0 rounded-lg border border-border text-xl text-ink-dim"
                >
                  +
                </button>
              </div>
              <p className="mb-4 text-xs text-ink-dim">
                bipadas {posicaoAtual.capacidade > 0 && `de ${posicaoAtual.capacidade} de capacidade`}
              </p>

              {!ajusteManual ? (
                <form onSubmit={aoBiparUnidade} className="mx-auto mb-4 max-w-xs">
                  <input
                    ref={inputBipRef}
                    value={entradaBip}
                    onChange={(e) => setEntradaBip(e.target.value)}
                    placeholder="Bipe cada camisa aqui…"
                    autoComplete="off"
                    className={`${classeInput} text-center`}
                  />
                  {avisoBip && <p className="mt-2 text-xs text-alert">{avisoBip}</p>}
                  <button
                    type="button"
                    onClick={() => setAjusteManual(true)}
                    className="mt-3 text-xs text-ink-dim underline underline-offset-2"
                  >
                    Já sei o número, digitar direto
                  </button>
                </form>
              ) : (
                <div className="mx-auto mb-4 max-w-xs">
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    value={contagem}
                    onChange={(e) => setContagem(Math.max(0, Number(e.target.value) || 0))}
                    className={`${classeInput} text-center text-lg`}
                  />
                  <button
                    type="button"
                    onClick={() => setAjusteManual(false)}
                    className="mt-3 text-xs text-ink-dim underline underline-offset-2"
                  >
                    Voltar a bipar
                  </button>
                </div>
              )}

              {avisoDupla && (
                <p className="mx-auto mb-3 max-w-xs rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                  {avisoDupla}
                </p>
              )}

              <button
                onClick={confirmarAndar}
                disabled={salvando}
                className="mx-auto block w-full max-w-xs rounded-lg bg-ok px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {salvando
                  ? "Salvando…"
                  : conferenciaDupla && primeiraContagem === null
                  ? `Confirmar 1ª contagem (${contagem})`
                  : conferenciaDupla
                  ? `Confirmar 2ª contagem (${contagem})`
                  : `✔ Confirmar ${contagem} e próximo cesto`}
              </button>

              {concluidos.length > 0 && (
                <p className="mt-6 text-xs text-ink-dim">{concluidos.length} cesto(s) já confirmado(s) nesse endereço.</p>
              )}
            </div>
          ) : (
            <div>
              <p className="mb-4 text-center text-ok">✅ Inventário do endereço {enderecoEscolhido} concluído!</p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-dim">
                    <th className="px-2 py-2 font-medium">Andar</th>
                    <th className="px-2 py-2 font-medium">Antes</th>
                    <th className="px-2 py-2 font-medium">Contado</th>
                    <th className="px-2 py-2 font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {concluidos.map((c) => (
                    <tr key={c.andar} className="border-b border-border last:border-0">
                      <td className="px-2 py-2 text-ink">{c.andar}</td>
                      <td className="px-2 py-2 text-ink-dim">{c.antes}</td>
                      <td className="px-2 py-2 text-ink">{c.depois}</td>
                      <td className={`px-2 py-2 ${c.depois - c.antes === 0 ? "text-ink-dim" : c.depois - c.antes > 0 ? "text-ok" : "text-alert"}`}>
                        {c.depois - c.antes === 0 ? "—" : c.depois - c.antes > 0 ? `+${c.depois - c.antes}` : c.depois - c.antes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-center gap-3">
                <button onClick={encerrarInventario} className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink">
                  Inventariar outro endereço
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
