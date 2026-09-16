"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Local, Posicao, compararColunas, descricaoProduto, ruaDaColuna } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

export default function InventarioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [locais, setLocais] = useState<Local[]>([]);
  const [localAtivoId, setLocalAtivoId] = useState("");
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [contagens, setContagens] = useState<Record<string, string>>({});
  const [filtroRua, setFiltroRua] = useState("todas");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

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
    return () => {
      ativo = false;
    };
  }, [supabase]);

  const posicoesDoLocal = useMemo(
    () => posicoes.filter((p) => p.local_id === localAtivoId),
    [posicoes, localAtivoId]
  );

  const ruasDisponiveis = useMemo(
    () => Array.from(new Set(posicoesDoLocal.map((p) => ruaDaColuna(p.codigo_coluna)))).sort(),
    [posicoesDoLocal]
  );

  const posicoesFiltradas = useMemo(() => {
    const lista =
      filtroRua === "todas" ? posicoesDoLocal : posicoesDoLocal.filter((p) => ruaDaColuna(p.codigo_coluna) === filtroRua);
    return [...lista].sort((a, b) => compararColunas(a.codigo_coluna, b.codigo_coluna) || a.andar - b.andar);
  }, [posicoesDoLocal, filtroRua]);

  const alteracoes = useMemo(() => {
    return posicoesFiltradas
      .map((p) => {
        const contado = contagens[p.id];
        if (contado === undefined || contado === "") return null;
        const valor = Math.max(0, Number(contado) || 0);
        if (valor === p.quantidade_atual) return null;
        return { posicao: p, novaQtd: valor, diferenca: valor - p.quantidade_atual };
      })
      .filter((x): x is { posicao: Posicao; novaQtd: number; diferenca: number } => x !== null);
  }, [posicoesFiltradas, contagens]);

  function atualizarContagem(id: string, valor: string) {
    setContagens((prev) => ({ ...prev, [id]: valor }));
  }

  async function registrarNome(): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "Sem login";
    const { data: perfil } = await supabase.from("perfis").select("nome").eq("id", user.id).maybeSingle();
    return perfil?.nome ?? user.email ?? "Usuário";
  }

  async function salvarInventario() {
    if (alteracoes.length === 0) return;
    if (
      !window.confirm(
        `Aplicar a contagem em ${alteracoes.length} posição${alteracoes.length === 1 ? "" : "ões"}? Isso ajusta a quantidade no sistema pro valor contado.`
      )
    )
      return;

    setSalvando(true);
    const nome = await registrarNome();

    for (const alt of alteracoes) {
      await supabase
        .from("posicoes")
        .update({ quantidade_atual: alt.novaQtd, atualizado_em: new Date().toISOString() })
        .eq("id", alt.posicao.id);

      await supabase.from("movimentacoes").insert({
        posicao_id: alt.posicao.id,
        tipo: "ajuste",
        quantidade: Math.abs(alt.diferenca),
        quantidade_resultante: alt.novaQtd,
        responsavel_nome: `${nome} (inventário)`,
      });
    }

    setPosicoes((prev) =>
      prev.map((p) => {
        const alt = alteracoes.find((a) => a.posicao.id === p.id);
        return alt ? { ...p, quantidade_atual: alt.novaQtd } : p;
      })
    );
    setContagens({});
    setSalvando(false);
    setAviso(`Inventário aplicado: ${alteracoes.length} posição${alteracoes.length === 1 ? "" : "ões"} atualizada${alteracoes.length === 1 ? "" : "s"}.`);
    setTimeout(() => setAviso(null), 5000);
  }

  const classeInput =
    "w-24 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-center text-ink outline-none focus:border-accent";

  return (
    <div>
      <PageHeader
        titulo="Inventário"
        subtitulo="Digite a quantidade que você contou fisicamente em cada posição. Só o que você preencher é alterado."
        acao={
          <button
            onClick={salvarInventario}
            disabled={salvando || alteracoes.length === 0}
            className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {salvando ? "Salvando…" : `Aplicar contagem (${alteracoes.length})`}
          </button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-sm text-ink-dim">Local / galpão</span>
            <select
              value={localAtivoId}
              onChange={(e) => setLocalAtivoId(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
            >
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-sm text-ink-dim">Rua</span>
            <select
              value={filtroRua}
              onChange={(e) => setFiltroRua(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
            >
              <option value="todas">Todas</option>
              {ruasDisponiveis.map((r) => (
                <option key={r} value={r}>
                  Rua {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        {aviso && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{aviso}</p>}
      </Card>

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando…</p>
      ) : posicoesFiltradas.length === 0 ? (
        <Card>
          <p className="text-ink-dim">Nenhuma posição encontrada com esse filtro.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="scroll-safe max-w-full">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-dim">
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Coluna</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Andar</th>
                  <th className="px-4 py-2.5 font-medium">Produto</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tamanho</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Sistema</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Contado</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {posicoesFiltradas.map((p) => {
                  const contado = contagens[p.id] ?? "";
                  const valor = contado === "" ? null : Math.max(0, Number(contado) || 0);
                  const diferenca = valor === null ? null : valor - p.quantidade_atual;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink">{p.codigo_coluna}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink">{p.andar}</td>
                      <td className="px-4 py-2.5 text-ink">
                        <span className="flex items-center gap-2">
                          {p.imagem_base64 && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imagem_base64} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                          )}
                          {descricaoProduto(p)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink">{p.tamanho ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-dim">{p.quantidade_atual}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          value={contado}
                          onChange={(e) => atualizarContagem(p.id, e.target.value)}
                          placeholder="—"
                          className={classeInput}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {diferenca === null ? (
                          <span className="text-ink-dim">—</span>
                        ) : diferenca === 0 ? (
                          <span className="text-ink-dim">sem diferença</span>
                        ) : (
                          <span className={diferenca > 0 ? "text-ok" : "text-alert"}>
                            {diferenca > 0 ? `+${diferenca}` : diferenca}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
