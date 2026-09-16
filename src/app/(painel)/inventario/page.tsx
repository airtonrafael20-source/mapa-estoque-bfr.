"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Local, Posicao, compararColunas, descricaoProduto } from "@/lib/types";
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
  const [contagem, setContagem] = useState("");
  const [concluidos, setConcluidos] = useState<{ andar: number; antes: number; depois: number }[]>([]);
  const [salvando, setSalvando] = useState(false);

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

  function iniciarInventario() {
    if (!enderecoEscolhido) return;
    setPassoAtual(0);
    setContagem("");
    setConcluidos([]);
    setInventariando(true);
  }

  function encerrarInventario() {
    setInventariando(false);
    setEnderecoEscolhido("");
    setConcluidos([]);
  }

  async function registrarNome(): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "Sem login";
    const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
    return perfil?.nome ?? user.email ?? "Usuário";
  }

  async function confirmarAndar() {
    if (!posicaoAtual || contagem === "") return;
    const valor = Math.max(0, Number(contagem) || 0);
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
    setContagem("");

    if (passoAtual + 1 < andaresDoEndereco.length) {
      setPassoAtual((p) => p + 1);
    } else {
      setPassoAtual((p) => p + 1); // passa do fim → mostra resumo
    }
  }

  const terminouEndereco = inventariando && passoAtual >= andaresDoEndereco.length;

  const classeInput =
    "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent";

  return (
    <div>
      <PageHeader
        titulo="Inventário"
        subtitulo="Escolha um endereço, inicie, e vá contando andar por andar — cada confirmação já atualiza o sistema na hora."
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
                Andar {passoAtual + 1} de {andaresDoEndereco.length}
              </p>
              {posicaoAtual.imagem_base64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={posicaoAtual.imagem_base64}
                  alt=""
                  className="mx-auto mb-3 h-28 w-28 rounded-xl border border-border object-cover"
                />
              )}
              <p className="mb-1 font-display text-xl font-bold text-ink">{descricaoProduto(posicaoAtual)}</p>
              <p className="mb-6 text-sm text-ink-dim">Sistema tem {posicaoAtual.quantidade_atual} registrado</p>

              <div className="mx-auto flex max-w-xs items-center gap-2">
                <input
                  type="number"
                  min={0}
                  autoFocus
                  value={contagem}
                  onChange={(e) => setContagem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmarAndar()}
                  placeholder="Quantidade contada"
                  className={`${classeInput} text-center text-lg`}
                />
                <button
                  onClick={confirmarAndar}
                  disabled={salvando || contagem === ""}
                  className="shrink-0 rounded-lg bg-ok px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {salvando ? "…" : "✔"}
                </button>
              </div>

              {concluidos.length > 0 && (
                <p className="mt-6 text-xs text-ink-dim">{concluidos.length} andar(es) já confirmado(s) nesse endereço.</p>
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
