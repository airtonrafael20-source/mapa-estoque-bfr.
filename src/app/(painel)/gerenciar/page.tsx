"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Local, Posicao, proximaColuna, ruaDaColuna } from "@/lib/types";
import { comprimirImagem } from "@/lib/imagem";
import { Card, PageHeader } from "@/components/ui";

interface FormNovo {
  codigo_coluna: string;
  andar: string;
  produto: string;
  tamanho: string;
  marca: string;
  ano: string;
  codigo_barras: string;
  capacidade: string;
  quantidade_atual: string;
  imagem: string;
  aplicarTodosAndares: boolean;
}

const FORM_VAZIO: FormNovo = {
  codigo_coluna: "",
  andar: "1",
  produto: "",
  tamanho: "",
  marca: "",
  ano: "",
  codigo_barras: "",
  capacidade: "40",
  quantidade_atual: "0",
  imagem: "",
  aplicarTodosAndares: true,
};

const ANDARES_POR_COLUNA = 6;

const classeInput =
  "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent";

export default function GerenciarPage() {
  const supabase = useMemo(() => createClient(), []);
  const [locais, setLocais] = useState<Local[]>([]);
  const [localAtivoId, setLocalAtivoId] = useState<string>("");
  const [novoLocal, setNovoLocal] = useState("");
  const [editandoLocalNome, setEditandoLocalNome] = useState("");
  const [editandoLocal, setEditandoLocal] = useState(false);

  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<FormNovo>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const inputImagemRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const colunaInputRef = useRef<HTMLInputElement>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Partial<Posicao>>({});

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [processandoSelecao, setProcessandoSelecao] = useState(false);

  const [loteRua, setLoteRua] = useState("");
  const [loteProduto, setLoteProduto] = useState("");
  const [loteMarca, setLoteMarca] = useState("");
  const [loteAno, setLoteAno] = useState("");
  const [loteCapacidade, setLoteCapacidade] = useState("40");
  const [loteTamanhos, setLoteTamanhos] = useState("P, M, G, GG, 2GG, 4GG, 6GG");
  const [loteSalvando, setLoteSalvando] = useState(false);
  const [loteErro, setLoteErro] = useState<string | null>(null);
  const [loteAviso, setLoteAviso] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const [{ data: dLocais }, { data: dPos }] = await Promise.all([
        supabase.from("locais").select("*").order("criado_em", { ascending: true }),
        supabase.from("posicoes").select("*").order("codigo_coluna", { ascending: true }).order("andar", { ascending: true }),
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
      .channel("gerenciar-posicoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posicoes" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "locais" }, () => carregar())
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [supabase]);

  async function adicionarLocal() {
    if (!novoLocal.trim()) return;
    const { data, error } = await supabase.from("locais").insert({ nome: novoLocal.trim() }).select().single();
    if (!error && data) {
      setLocais((prev) => [...prev, data as Local]);
      setLocalAtivoId((data as Local).id);
      setNovoLocal("");
    }
  }

  async function renomearLocal() {
    if (!editandoLocalNome.trim() || !localAtivoId) return;
    await supabase.from("locais").update({ nome: editandoLocalNome.trim() }).eq("id", localAtivoId);
    setLocais((prev) =>
      prev.map((l) => (l.id === localAtivoId ? { ...l, nome: editandoLocalNome.trim() } : l))
    );
    setEditandoLocal(false);
  }

  const posicoesDoLocal = useMemo(
    () => posicoes.filter((p) => p.local_id === localAtivoId),
    [posicoes, localAtivoId]
  );

  const porRua = useMemo(() => {
    const mapa = new Map<string, Posicao[]>();
    for (const p of posicoesDoLocal) {
      const rua = ruaDaColuna(p.codigo_coluna);
      if (!mapa.has(rua)) mapa.set(rua, []);
      mapa.get(rua)!.push(p);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.codigo_coluna.localeCompare(b.codigo_coluna) || a.andar - b.andar);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [posicoesDoLocal]);

  const colunasExistentes = useMemo(
    () => Array.from(new Set(posicoesDoLocal.map((p) => p.codigo_coluna))),
    [posicoesDoLocal]
  );

  function preencherProximaColuna(rua: string) {
    setForm((f) => ({ ...f, codigo_coluna: proximaColuna(rua, colunasExistentes) }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => colunaInputRef.current?.focus(), 350);
  }

  async function criarRuaCompleta(e: React.FormEvent) {
    e.preventDefault();
    setLoteErro(null);
    setLoteAviso(null);

    const rua = loteRua.trim().toUpperCase();
    const tamanhos = loteTamanhos
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (!rua || tamanhos.length === 0 || !localAtivoId) {
      setLoteErro("Preenche a rua e pelo menos um tamanho.");
      return;
    }

    setLoteSalvando(true);

    // Acha o próximo número de coluna livre nessa rua, e vai numerando
    // uma coluna pra cada tamanho da lista (P → -1, M → -2, e assim por diante).
    const numerosExistentes = colunasExistentes
      .filter((c) => ruaDaColuna(c).toUpperCase() === rua)
      .map((c) => parseInt(c.split("-")[1] ?? "0", 10))
      .filter((n) => !isNaN(n));
    const proximoNumero = numerosExistentes.length > 0 ? Math.max(...numerosExistentes) + 1 : 1;

    const linhas = tamanhos.flatMap((tamanho, indice) => {
      const codigo_coluna = `${rua}-${proximoNumero + indice}`;
      return Array.from({ length: ANDARES_POR_COLUNA }, (_, i) => ({
        local_id: localAtivoId,
        codigo_coluna,
        andar: i + 1,
        produto: loteProduto.trim() || null,
        tamanho,
        marca: loteMarca.trim() || null,
        ano: loteAno.trim() || null,
        capacidade: Number(loteCapacidade) || 40,
        quantidade_atual: 0,
      }));
    });

    const { error } = await supabase
      .from("posicoes")
      .upsert(linhas, { onConflict: "codigo_coluna,andar", ignoreDuplicates: true });

    if (error) {
      setLoteSalvando(false);
      setLoteErro("Não consegui criar a rua. Confere os campos.");
      return;
    }

    const { data: novas } = await supabase
      .from("posicoes")
      .select("*")
      .eq("local_id", localAtivoId)
      .in("codigo_coluna", tamanhos.map((_, i) => `${rua}-${proximoNumero + i}`));

    setPosicoes((prev) => {
      const idsNovos = new Set((novas as Posicao[] | null)?.map((p) => p.id));
      return [...prev.filter((p) => !idsNovos.has(p.id)), ...((novas as Posicao[]) ?? [])];
    });

    setLoteSalvando(false);
    setLoteAviso(
      `Rua ${rua}: criadas ${tamanhos.length} colunas (${rua}-${proximoNumero} a ${rua}-${
        proximoNumero + tamanhos.length - 1
      }), 1 tamanho por coluna, ${ANDARES_POR_COLUNA} andares cada.`
    );
    setLoteProduto("");
    setTimeout(() => setLoteAviso(null), 6000);
  }

  async function aoEscolherImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const base64 = await comprimirImagem(arquivo);
    setForm((f) => ({ ...f, imagem: base64 }));
  }

  async function criarPosicao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setSalvando(true);

    const base = {
      local_id: localAtivoId || null,
      codigo_coluna: form.codigo_coluna.trim().toUpperCase(),
      produto: form.produto.trim() || null,
      tamanho: form.tamanho.trim() || null,
      marca: form.marca.trim() || null,
      ano: form.ano.trim() || null,
      codigo_barras: form.codigo_barras.trim() || null,
      imagem_base64: form.imagem || null,
      capacidade: Number(form.capacidade) || 40,
      quantidade_atual: Number(form.quantidade_atual) || 0,
    };

    if (form.aplicarTodosAndares) {
      // Cria (ou completa) todos os andares dessa coluna de uma vez —
      // andares que já existem são pulados, não dá erro.
      const linhas = Array.from({ length: ANDARES_POR_COLUNA }, (_, i) => ({
        ...base,
        andar: i + 1,
      }));

      const { error } = await supabase
        .from("posicoes")
        .upsert(linhas, { onConflict: "codigo_coluna,andar", ignoreDuplicates: true });

      if (error) {
        setSalvando(false);
        setErro("Não consegui salvar em lote. Confere os campos.");
        return;
      }

      const { data: atualizadas } = await supabase
        .from("posicoes")
        .select("*")
        .eq("codigo_coluna", base.codigo_coluna)
        .eq("local_id", localAtivoId || null);

      setPosicoes((prev) => {
        const outrasColunas = prev.filter((p) => p.codigo_coluna !== base.codigo_coluna);
        return [...outrasColunas, ...((atualizadas as Posicao[]) ?? [])];
      });

      setSalvando(false);
      setAviso(`Coluna ${base.codigo_coluna}: andares 1 a ${ANDARES_POR_COLUNA} preenchidos.`);
      setForm({ ...FORM_VAZIO, codigo_coluna: "" });
      if (inputImagemRef.current) inputImagemRef.current.value = "";
      setTimeout(() => setAviso(null), 4000);
      return;
    }

    const { data, error } = await supabase
      .from("posicoes")
      .insert({ ...base, andar: Number(form.andar) })
      .select()
      .single();

    setSalvando(false);
    if (error) {
      setErro(
        error.code === "23505"
          ? "Já existe uma posição com essa coluna + andar."
          : "Não consegui salvar. Confere os campos."
      );
      return;
    }

    setPosicoes((prev) => [...prev, data as Posicao]);
    setForm({ ...FORM_VAZIO, codigo_coluna: form.codigo_coluna });
    if (inputImagemRef.current) inputImagemRef.current.value = "";
  }

  function abrirEdicao(p: Posicao) {
    setEditandoId(p.id);
    setEdicao({ ...p });
  }

  async function salvarEdicao(id: string) {
    setSalvando(true);
    const atualizacao = {
      produto: edicao.produto || null,
      tamanho: edicao.tamanho || null,
      marca: edicao.marca || null,
      ano: edicao.ano || null,
      codigo_barras: edicao.codigo_barras || null,
      capacidade: Number(edicao.capacidade) || 40,
      quantidade_atual: Math.max(0, Number(edicao.quantidade_atual) || 0),
      imagem_base64: edicao.imagem_base64 || null,
      observacoes: edicao.observacoes || null,
    };
    const { error } = await supabase.from("posicoes").update(atualizacao).eq("id", id);
    setSalvando(false);
    if (!error) {
      setPosicoes((prev) => prev.map((x) => (x.id === id ? { ...x, ...atualizacao } : x)));
      setEditandoId(null);
      setEdicao({});
    }
  }

  async function aoEscolherImagemEdicao(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const base64 = await comprimirImagem(arquivo);
    setEdicao((prev) => ({ ...prev, imagem_base64: base64 }));
  }

  async function excluirPosicao(p: Posicao) {
    if (!window.confirm(`Excluir a posição ${p.codigo_coluna} · andar ${p.andar}?`)) return;
    setPosicoes((prev) => prev.filter((x) => x.id !== p.id));
    await supabase.from("posicoes").delete().eq("id", p.id);
  }

  function alternarSelecao(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function selecionarTodosDaRua(itensRua: Posicao[], marcar: boolean) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      for (const p of itensRua) {
        if (marcar) novo.add(p.id);
        else novo.delete(p.id);
      }
      return novo;
    });
  }

  async function excluirSelecionados() {
    if (selecionados.size === 0) return;
    if (!window.confirm(`Excluir ${selecionados.size} posições selecionadas? Isso não pode ser desfeito.`)) return;
    setProcessandoSelecao(true);
    const ids = Array.from(selecionados);
    setPosicoes((prev) => prev.filter((p) => !selecionados.has(p.id)));
    await supabase.from("posicoes").delete().in("id", ids);
    setSelecionados(new Set());
    setProcessandoSelecao(false);
  }

  async function limparSelecionados() {
    if (selecionados.size === 0) return;
    if (
      !window.confirm(
        `Limpar ${selecionados.size} posições selecionadas? Isso apaga o produto/tamanho/foto e zera a quantidade, mas mantém a posição cadastrada (coluna e andar continuam existindo, vazios).`
      )
    )
      return;
    setProcessandoSelecao(true);
    const ids = Array.from(selecionados);
    const limpo = {
      produto: null,
      tamanho: null,
      marca: null,
      ano: null,
      codigo_barras: null,
      imagem_base64: null,
      quantidade_atual: 0,
    };
    setPosicoes((prev) => prev.map((p) => (selecionados.has(p.id) ? { ...p, ...limpo } : p)));
    await supabase.from("posicoes").update(limpo).in("id", ids);
    setSelecionados(new Set());
    setProcessandoSelecao(false);
  }

  async function moverColuna(codigoAtual: string) {
    const novoCodigo = window.prompt(`Mover a coluna "${codigoAtual}" (com todos os andares) para qual código?`, codigoAtual);
    if (!novoCodigo || novoCodigo.trim().toUpperCase() === codigoAtual) return;
    const destino = novoCodigo.trim().toUpperCase();

    const { error } = await supabase
      .from("posicoes")
      .update({ codigo_coluna: destino })
      .eq("codigo_coluna", codigoAtual)
      .eq("local_id", localAtivoId);

    if (error) {
      window.alert(
        `Não consegui mover — provavelmente já existe uma coluna "${destino}" com andares que colidem com os dessa.`
      );
      return;
    }

    setPosicoes((prev) =>
      prev.map((p) => (p.codigo_coluna === codigoAtual && p.local_id === localAtivoId ? { ...p, codigo_coluna: destino } : p))
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Gerenciar posições"
        subtitulo="Organizado por rua (A, B, C…). Cadastre colunas/andares e atribua o produto."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-sm text-ink-dim">Local / galpão</span>
            {editandoLocal ? (
              <div className="flex gap-2">
                <input
                  value={editandoLocalNome}
                  onChange={(e) => setEditandoLocalNome(e.target.value)}
                  className={classeInput}
                  autoFocus
                />
                <button type="button" onClick={renomearLocal} className="shrink-0 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-accent-ink">
                  Salvar
                </button>
                <button type="button" onClick={() => setEditandoLocal(false)} className="shrink-0 rounded-lg border border-border px-3 py-2.5 text-sm text-ink-dim">
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={localAtivoId} onChange={(e) => setLocalAtivoId(e.target.value)} className={classeInput}>
                  {locais.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const atual = locais.find((l) => l.id === localAtivoId);
                    setEditandoLocalNome(atual?.nome ?? "");
                    setEditandoLocal(true);
                  }}
                  title="Renomear esse local"
                  className="shrink-0 rounded-lg border border-border px-3 py-2.5 text-ink-dim hover:text-ink"
                >
                  ✎
                </button>
              </div>
            )}
          </label>
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-sm text-ink-dim">Adicionar novo local</span>
            <div className="flex gap-2">
              <input value={novoLocal} onChange={(e) => setNovoLocal(e.target.value)} placeholder="Ex.: Depósito Pavuna" className={classeInput} />
              <button type="button" onClick={adicionarLocal} className="shrink-0 rounded-lg border border-accent px-4 py-2.5 font-semibold text-accent">
                + Criar
              </button>
            </div>
          </label>
        </div>
      </Card>

      <Card className="mb-6 border-accent/40">
        <h2 className="mb-1 font-display text-base font-semibold tracking-wide text-ink">
          CRIAR RUA COMPLETA (VÁRIAS COLUNAS DE UMA VEZ)
        </h2>
        <p className="mb-4 text-sm text-ink-dim">
          Digite os tamanhos separados por vírgula — uma coluna é criada pra cada tamanho, já com os{" "}
          {ANDARES_POR_COLUNA} andares preenchidos.
        </p>
        <form onSubmit={criarRuaCompleta} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Rua</span>
            <input required value={loteRua} onChange={(e) => setLoteRua(e.target.value)} placeholder="A" className={classeInput} />
          </label>
          <label className="col-span-2 block min-w-0 sm:col-span-1 lg:col-span-2">
            <span className="mb-1.5 block text-sm text-ink-dim">Produto</span>
            <input value={loteProduto} onChange={(e) => setLoteProduto(e.target.value)} placeholder="Camisa Masc Home Mizuno 26/27" className={classeInput} />
          </label>
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Marca</span>
            <input value={loteMarca} onChange={(e) => setLoteMarca(e.target.value)} placeholder="Mizuno" className={classeInput} />
          </label>
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Ano</span>
            <input value={loteAno} onChange={(e) => setLoteAno(e.target.value)} placeholder="26/27" className={classeInput} />
          </label>
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Capacidade</span>
            <input type="number" min={1} value={loteCapacidade} onChange={(e) => setLoteCapacidade(e.target.value)} className={classeInput} />
          </label>
          <label className="col-span-2 block min-w-0 sm:col-span-3 lg:col-span-6">
            <span className="mb-1.5 block text-sm text-ink-dim">Tamanhos (um vira uma coluna, nessa ordem)</span>
            <input
              required
              value={loteTamanhos}
              onChange={(e) => setLoteTamanhos(e.target.value)}
              placeholder="P, M, G, GG, 2GG, 4GG, 6GG"
              className={classeInput}
            />
          </label>
          <div className="col-span-2 flex items-end sm:col-span-3 lg:col-span-6">
            <button type="submit" disabled={loteSalvando || !localAtivoId} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
              {loteSalvando ? "Criando…" : "Criar todas as colunas dessa rua"}
            </button>
          </div>
        </form>
        {loteErro && <p className="mt-3 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">{loteErro}</p>}
        {loteAviso && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{loteAviso}</p>}
      </Card>

      <div ref={formRef}>
      <Card className="mb-6">
        <h2 className="mb-4 font-display text-base font-semibold tracking-wide text-ink">NOVA POSIÇÃO</h2>
        <form onSubmit={criarPosicao} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Coluna</span>
            <input required ref={colunaInputRef} value={form.codigo_coluna} onChange={(e) => setForm((f) => ({ ...f, codigo_coluna: e.target.value }))} placeholder="A-1" className={classeInput} />
          </label>
          <label className={`col-span-1 block min-w-0 ${form.aplicarTodosAndares ? "opacity-40" : ""}`}>
            <span className="mb-1.5 block text-sm text-ink-dim">Andar</span>
            <select
              disabled={form.aplicarTodosAndares}
              value={form.andar}
              onChange={(e) => setForm((f) => ({ ...f, andar: e.target.value }))}
              className={classeInput}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block min-w-0 sm:col-span-1 lg:col-span-2">
            <span className="mb-1.5 block text-sm text-ink-dim">Produto</span>
            <input value={form.produto} onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))} placeholder="Camisa Masc Home Mizuno 26/27" className={classeInput} />
          </label>
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Tamanho</span>
            <input value={form.tamanho} onChange={(e) => setForm((f) => ({ ...f, tamanho: e.target.value }))} placeholder="P, M, GG…" className={classeInput} />
          </label>
          <label className="col-span-2 block min-w-0 sm:col-span-1 lg:col-span-2">
            <span className="mb-1.5 block text-sm text-ink-dim">Código de barras</span>
            <input value={form.codigo_barras} onChange={(e) => setForm((f) => ({ ...f, codigo_barras: e.target.value }))} placeholder="7908225543551" className={classeInput} />
          </label>
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Marca</span>
            <input value={form.marca} onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))} placeholder="Mizuno" className={classeInput} />
          </label>
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Ano</span>
            <input value={form.ano} onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))} placeholder="26/27" className={classeInput} />
          </label>
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">Capacidade</span>
            <input type="number" min={1} value={form.capacidade} onChange={(e) => setForm((f) => ({ ...f, capacidade: e.target.value }))} className={classeInput} />
          </label>
          <label className="col-span-1 block min-w-0">
            <span className="mb-1.5 block text-sm text-ink-dim">
              Qtd. inicial{form.aplicarTodosAndares ? " (por andar)" : ""}
            </span>
            <input
              type="number"
              min={0}
              value={form.quantidade_atual}
              onChange={(e) => setForm((f) => ({ ...f, quantidade_atual: e.target.value }))}
              className={classeInput}
            />
          </label>
          <label className="col-span-2 block min-w-0 sm:col-span-3 lg:col-span-2">
            <span className="mb-1.5 block text-sm text-ink-dim">Foto do produto</span>
            <input ref={inputImagemRef} type="file" accept="image/*" onChange={aoEscolherImagem} className={`${classeInput} p-1.5`} />
          </label>

          <label className="col-span-2 flex items-center gap-2 sm:col-span-3 lg:col-span-6">
            <input
              type="checkbox"
              checked={form.aplicarTodosAndares}
              onChange={(e) => setForm((f) => ({ ...f, aplicarTodosAndares: e.target.checked }))}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm text-ink">
              Aplicar esse produto aos {ANDARES_POR_COLUNA} andares dessa coluna de uma vez (já vem marcado —
              desmarca se cada andar dessa coluna for um produto diferente)
            </span>
          </label>

          <div className="col-span-2 flex items-end sm:col-span-3 lg:col-span-6">
            <button type="submit" disabled={salvando || !localAtivoId} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
              {salvando ? "Salvando…" : form.aplicarTodosAndares ? `Preencher os ${ANDARES_POR_COLUNA} andares` : "Adicionar posição"}
            </button>
          </div>
        </form>
        {erro && <p className="mt-3 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">{erro}</p>}
        {aviso && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{aviso}</p>}
      </Card>
      </div>

      {carregando ? (
        <p className="text-sm text-ink-dim">Carregando…</p>
      ) : porRua.length === 0 ? (
        <Card>
          <p className="text-ink-dim">Nenhuma posição cadastrada nesse local ainda.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {selecionados.size > 0 && (
            <Card className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 border-accent/40 bg-surface py-3">
              <p className="text-sm text-ink">
                <span className="font-semibold text-accent">{selecionados.size}</span> selecionada
                {selecionados.size === 1 ? "" : "s"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={limparSelecionados}
                  disabled={processandoSelecao}
                  className="rounded-lg border border-pend px-3 py-1.5 text-sm font-semibold text-pend disabled:opacity-60"
                >
                  Limpar selecionadas
                </button>
                <button
                  onClick={excluirSelecionados}
                  disabled={processandoSelecao}
                  className="rounded-lg border border-alert px-3 py-1.5 text-sm font-semibold text-alert disabled:opacity-60"
                >
                  Excluir selecionadas
                </button>
                <button
                  onClick={() => setSelecionados(new Set())}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink-dim"
                >
                  Limpar seleção
                </button>
              </div>
            </Card>
          )}

          {porRua.map(([rua, itens]) => {
            const todosSelecionados = itens.every((p) => selecionados.has(p.id));
            const colunasNaRua = Array.from(new Set(itens.map((p) => p.codigo_coluna)));
            return (
            <Card key={rua} className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={(e) => selecionarTodosDaRua(itens, e.target.checked)}
                    title="Selecionar todos os andares dessa rua"
                    className="h-4 w-4 accent-accent"
                  />
                  <h3 className="font-display text-lg font-semibold tracking-wide text-ink">Rua {rua}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {colunasNaRua.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) moverColuna(e.target.value);
                        e.target.value = "";
                      }}
                      defaultValue=""
                      className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs text-ink-dim"
                      title="Mover/renomear uma coluna inteira"
                    >
                      <option value="" disabled>
                        ↦ Mover coluna…
                      </option>
                      {colunasNaRua.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={() => preencherProximaColuna(rua)} className="shrink-0 rounded-lg border border-accent px-3 py-1.5 text-sm font-semibold text-accent">
                    + Nova coluna nessa rua
                  </button>
                </div>
              </div>
              <div className="scroll-safe max-w-full">
                <table className="w-full min-w-[940px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-dim">
                      <th className="w-8 px-4 py-2.5"></th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Coluna</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Andar</th>
                      <th className="px-4 py-2.5 font-medium">Produto</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Tamanho</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Cód. barras</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Capacidade</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Qtd. atual</th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((p) => {
                      const emEdicao = editandoId === p.id;
                      return (
                        <Fragment key={p.id}>
                          <tr className="border-b border-border last:border-0 hover:bg-surface-2/60">
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                checked={selecionados.has(p.id)}
                                onChange={() => alternarSelecao(p.id)}
                                className="h-4 w-4 accent-accent"
                              />
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-ink">{p.codigo_coluna}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-ink">{p.andar}</td>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2 text-ink">
                                {p.imagem_base64 && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.imagem_base64} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                                )}
                                {p.produto ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-ink">{p.tamanho ?? "—"}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-dim">
                              {p.codigo_barras ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-ink">{p.capacidade}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-ink">
                              {p.quantidade_atual} / {p.capacidade}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => (emEdicao ? (setEditandoId(null), setEdicao({})) : abrirEdicao(p))}
                                  className={`rounded-md border px-2.5 py-1.5 ${
                                    emEdicao ? "border-accent text-accent" : "border-border text-ink-dim hover:text-ink"
                                  }`}
                                  title="Editar"
                                >
                                  ✎
                                </button>
                                <button onClick={() => excluirPosicao(p)} className="rounded-md border border-border px-2.5 py-1.5 text-ink-dim hover:border-alert hover:text-alert" title="Excluir">
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                          {emEdicao && (
                            <tr className="border-b border-border bg-surface-2/40 last:border-0">
                              <td colSpan={9} className="px-4 py-4">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                                  <label className="col-span-2 block min-w-0 sm:col-span-1 lg:col-span-2">
                                    <span className="mb-1.5 block text-xs text-ink-dim">Produto</span>
                                    <input value={edicao.produto ?? ""} onChange={(e) => setEdicao((prev) => ({ ...prev, produto: e.target.value }))} className={classeInput} />
                                  </label>
                                  <label className="col-span-1 block min-w-0">
                                    <span className="mb-1.5 block text-xs text-ink-dim">Tamanho</span>
                                    <input value={edicao.tamanho ?? ""} onChange={(e) => setEdicao((prev) => ({ ...prev, tamanho: e.target.value }))} className={classeInput} />
                                  </label>
                                  <label className="col-span-1 block min-w-0">
                                    <span className="mb-1.5 block text-xs text-ink-dim">Marca</span>
                                    <input value={edicao.marca ?? ""} onChange={(e) => setEdicao((prev) => ({ ...prev, marca: e.target.value }))} className={classeInput} />
                                  </label>
                                  <label className="col-span-1 block min-w-0">
                                    <span className="mb-1.5 block text-xs text-ink-dim">Ano</span>
                                    <input value={edicao.ano ?? ""} onChange={(e) => setEdicao((prev) => ({ ...prev, ano: e.target.value }))} className={classeInput} />
                                  </label>
                                  <label className="col-span-1 block min-w-0">
                                    <span className="mb-1.5 block text-xs text-ink-dim">Código de barras</span>
                                    <input value={edicao.codigo_barras ?? ""} onChange={(e) => setEdicao((prev) => ({ ...prev, codigo_barras: e.target.value }))} className={classeInput} />
                                  </label>
                                  <label className="col-span-1 block min-w-0">
                                    <span className="mb-1.5 block text-xs text-ink-dim">Capacidade</span>
                                    <input type="number" min={1} value={edicao.capacidade ?? 40} onChange={(e) => setEdicao((prev) => ({ ...prev, capacidade: Number(e.target.value) }))} className={classeInput} />
                                  </label>
                                  <label className="col-span-1 block min-w-0">
                                    <span className="mb-1.5 block text-xs text-ink-dim">Quantidade atual</span>
                                    <input type="number" min={0} value={edicao.quantidade_atual ?? 0} onChange={(e) => setEdicao((prev) => ({ ...prev, quantidade_atual: Number(e.target.value) }))} className={classeInput} />
                                  </label>
                                  <label className="col-span-2 block min-w-0 sm:col-span-2 lg:col-span-2">
                                    <span className="mb-1.5 block text-xs text-ink-dim">Trocar foto</span>
                                    <input type="file" accept="image/*" onChange={aoEscolherImagemEdicao} className={`${classeInput} p-1.5`} />
                                  </label>
                                  {edicao.imagem_base64 && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={edicao.imagem_base64} alt="" className="col-span-1 h-10 w-10 self-end rounded object-cover" />
                                  )}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <button onClick={() => salvarEdicao(p.id)} disabled={salvando} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
                                    {salvando ? "Salvando…" : "Salvar"}
                                  </button>
                                  <button onClick={() => { setEditandoId(null); setEdicao({}); }} className="rounded-lg border border-border px-4 py-2 text-sm text-ink-dim">
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
