"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, PageHeader } from "@/components/ui";
import LogoUploader from "@/components/LogoUploader";
import TrocarFundo from "@/components/TrocarFundo";
import RequerAdmin from "@/components/RequerAdmin";
import { useUI } from "@/components/ui-feedback";

interface Perfil {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

const CORES_SUGERIDAS = ["#d4af17", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#0891b2"];
const NOME_LOCAL_DEMO = "🎬 Demonstração";

export default function ConfiguracoesPage() {
  const [supabase] = useState(() => createClient());
  const { confirmar, toast } = useUI();
  const [nomeApp, setNomeApp] = useState("");
  const [subtituloApp, setSubtituloApp] = useState("");
  const [corPrincipal, setCorPrincipal] = useState("#d4af17");
  const [rodapeTexto, setRodapeTexto] = useState("");
  const [rodapeLink, setRodapeLink] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [carregandoPerfis, setCarregandoPerfis] = useState(true);
  const [meuId, setMeuId] = useState("");
  const [temDemo, setTemDemo] = useState(false);
  const [processandoDemo, setProcessandoDemo] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("configuracoes")
      .select("nome_app, subtitulo_app, cor_principal, rodape_texto, rodape_link")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        setNomeApp((data?.nome_app as string | null) || "Mapa de Estoque");
        setSubtituloApp((data?.subtitulo_app as string | null) || "BFR Fanáticos");
        setCorPrincipal((data?.cor_principal as string | null) || "#d4af17");
        setRodapeTexto((data?.rodape_texto as string | null) || "");
        setRodapeLink((data?.rodape_link as string | null) || "");
        setCarregando(false);
      });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && ativo) setMeuId(user.id);
    });

    supabase
      .from("perfis")
      .select("id, nome, email, role")
      .order("nome", { ascending: true })
      .then(({ data }) => {
        if (!ativo) return;
        setPerfis((data as Perfil[]) ?? []);
        setCarregandoPerfis(false);
      });

    supabase
      .from("locais")
      .select("id", { count: "exact", head: true })
      .eq("nome", NOME_LOCAL_DEMO)
      .then(({ count }) => {
        if (ativo) setTemDemo((count ?? 0) > 0);
      });

    return () => {
      ativo = false;
    };
  }, [supabase]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { error } = await supabase
      .from("configuracoes")
      .update({
        nome_app: nomeApp.trim() || "Mapa de Estoque",
        subtitulo_app: subtituloApp.trim() || "",
        cor_principal: corPrincipal,
        rodape_texto: rodapeTexto.trim() || null,
        rodape_link: rodapeLink.trim() || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", 1);
    setSalvando(false);

    if (error) {
      setErro(
        "Não consegui salvar — confere se rodou todas as migrações mais recentes no Supabase (cor_principal, rodape_texto, rodape_link)."
      );
      return;
    }
    toast("Configurações salvas!");
    setTimeout(() => window.location.reload(), 500);
  }

  async function mudarRole(id: string, novoRole: "admin" | "operador") {
    setPerfis((prev) => prev.map((p) => (p.id === id ? { ...p, role: novoRole } : p)));
    await supabase.from("perfis").update({ role: novoRole }).eq("id", id);
    toast("Permissão atualizada.");
  }

  async function criarDemo() {
    setProcessandoDemo(true);
    const { data: local } = await supabase.from("locais").insert({ nome: NOME_LOCAL_DEMO }).select().single();
    if (local) {
      const linhas = [];
      const produtos = [
        { produto: "Camisa Titular Exemplo", tamanho: "P", qtd: 40 },
        { produto: "Camisa Titular Exemplo", tamanho: "M", qtd: 22 },
        { produto: "Camisa Titular Exemplo", tamanho: "G", qtd: 4 },
        { produto: "Camisa Reserva Exemplo", tamanho: "M", qtd: 0 },
      ];
      for (let i = 0; i < produtos.length; i++) {
        for (let andar = 1; andar <= 6; andar++) {
          linhas.push({
            local_id: local.id,
            codigo_coluna: `A-1 C-${i + 1}`,
            andar,
            produto: produtos[i].produto,
            tamanho: produtos[i].tamanho,
            marca: "Marca Exemplo",
            ano: "26/27",
            capacidade: 40,
            quantidade_atual: andar === 1 ? produtos[i].qtd : 0,
          });
        }
      }
      await supabase.from("posicoes").insert(linhas);
    }
    setTemDemo(true);
    setProcessandoDemo(false);
    toast("Dados de demonstração criados — dá uma olhada no Mapa!");
  }

  async function removerDemo() {
    const ok = await confirmar("Remover todo o local de demonstração e os dados de exemplo?", { perigoso: true });
    if (!ok) return;
    setProcessandoDemo(true);
    const { data: local } = await supabase.from("locais").select("id").eq("nome", NOME_LOCAL_DEMO).maybeSingle();
    if (local) {
      await supabase.from("posicoes").delete().eq("local_id", local.id);
      await supabase.from("locais").delete().eq("id", local.id);
    }
    setTemDemo(false);
    setProcessandoDemo(false);
    toast("Dados de demonstração removidos.");
  }

  const classeInput =
    "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent";

  return (
    <RequerAdmin>
    <div>
      <PageHeader titulo="Configurações" subtitulo="Nome, cor, logo, fundo de tela e permissões." />

      <Card className="mb-4">
        <h2 className="mb-4 font-display text-base font-semibold tracking-wide text-ink">
          IDENTIDADE DO SISTEMA
        </h2>
        {carregando ? (
          <p className="text-sm text-ink-dim">Carregando…</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm text-ink-dim">Nome principal</span>
                <input value={nomeApp} onChange={(e) => setNomeApp(e.target.value)} placeholder="Mapa de Estoque" className={classeInput} />
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm text-ink-dim">Subtítulo (empresa/equipe)</span>
                <input value={subtituloApp} onChange={(e) => setSubtituloApp(e.target.value)} placeholder="Nome da empresa" className={classeInput} />
              </label>
            </div>

            <span className="mb-1.5 block text-sm text-ink-dim">Cor principal</span>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {CORES_SUGERIDAS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCorPrincipal(c)}
                  className="h-9 w-9 rounded-full border-2"
                  style={{ background: c, borderColor: corPrincipal === c ? "var(--ink)" : "transparent" }}
                  aria-label={c}
                />
              ))}
              <input type="color" value={corPrincipal} onChange={(e) => setCorPrincipal(e.target.value)} className="h-9 w-9 cursor-pointer rounded-full border-2 border-border bg-transparent" />
              <span className="text-xs text-ink-dim">{corPrincipal}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm text-ink-dim">Rodapé (opcional — ex.: &quot;Desenvolvido por Fulano&quot;)</span>
                <input value={rodapeTexto} onChange={(e) => setRodapeTexto(e.target.value)} placeholder="Desenvolvido por…" className={classeInput} />
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm text-ink-dim">Link do rodapé (opcional)</span>
                <input value={rodapeLink} onChange={(e) => setRodapeLink(e.target.value)} placeholder="https://…" className={classeInput} />
              </label>
            </div>
          </>
        )}
        <p className="mt-2 text-xs text-ink-dim">
          Tudo isso aparece no menu, no login, nos relatórios e no rodapé — é o que muda quando você reusar o
          sistema pra outra empresa.
        </p>
        {erro && <p className="mt-3 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">{erro}</p>}
        <button
          onClick={salvar}
          disabled={salvando || carregando}
          className="mt-4 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 font-display text-base font-semibold tracking-wide text-ink">LOGO</h2>
        <p className="mb-3 text-sm text-ink-dim">Clica no círculo pra trocar a logo (aparece no menu e no login).</p>
        <LogoUploader tamanho={64} />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 font-display text-base font-semibold tracking-wide text-ink">FUNDO DE TELA</h2>
        <p className="mb-3 text-sm text-ink-dim">Escolhe um tema pronto ou sobe sua própria foto.</p>
        <div className="max-w-xs">
          <TrocarFundo />
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 font-display text-base font-semibold tracking-wide text-ink">MODO DEMONSTRAÇÃO</h2>
        <p className="mb-4 text-sm text-ink-dim">
          Cria um local de exemplo (&quot;🎬 Demonstração&quot;) com dados fictícios — pra mostrar o sistema pra
          uma empresa nova sem mexer nos seus dados reais. Remove tudo com um clique quando terminar.
        </p>
        {temDemo ? (
          <button
            onClick={removerDemo}
            disabled={processandoDemo}
            className="rounded-lg border border-alert px-4 py-2.5 text-sm font-semibold text-alert disabled:opacity-60"
          >
            {processandoDemo ? "Removendo…" : "🗑 Remover dados de demonstração"}
          </button>
        ) : (
          <button
            onClick={criarDemo}
            disabled={processandoDemo}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {processandoDemo ? "Criando…" : "🎬 Criar dados de demonstração"}
          </button>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-display text-base font-semibold tracking-wide text-ink">USUÁRIOS E PERMISSÕES</h2>
        <p className="mb-4 text-sm text-ink-dim">
          <b>Admin</b> mexe em tudo, incluindo Gerenciar posições e Configurações. <b>Operador</b> usa Mapa,
          Bipar, Inventário, Recebimento etc., mas não consegue excluir posições, renomear ruas nem entrar
          aqui em Configurações.
        </p>
        {carregandoPerfis ? (
          <p className="text-sm text-ink-dim">Carregando…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {perfis.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {p.nome} {p.id === meuId && <span className="text-xs text-ink-dim">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-ink-dim">{p.email}</p>
                </div>
                <select
                  value={p.role}
                  onChange={(e) => mudarRole(p.id, e.target.value as "admin" | "operador")}
                  className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="admin">Admin</option>
                  <option value="operador">Operador</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
    </RequerAdmin>
  );
}
