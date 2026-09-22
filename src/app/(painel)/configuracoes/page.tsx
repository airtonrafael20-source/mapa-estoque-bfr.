"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, PageHeader } from "@/components/ui";
import LogoUploader from "@/components/LogoUploader";
import TrocarFundo from "@/components/TrocarFundo";
import RequerAdmin from "@/components/RequerAdmin";

interface Perfil {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

export default function ConfiguracoesPage() {
  const [supabase] = useState(() => createClient());
  const [nomeApp, setNomeApp] = useState("");
  const [subtituloApp, setSubtituloApp] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [carregandoPerfis, setCarregandoPerfis] = useState(true);
  const [meuId, setMeuId] = useState("");

  useEffect(() => {
    let ativo = true;
    supabase
      .from("configuracoes")
      .select("nome_app, subtitulo_app")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        setNomeApp((data?.nome_app as string | null) || "Mapa de Estoque");
        setSubtituloApp((data?.subtitulo_app as string | null) || "BFR Fanáticos");
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

    return () => {
      ativo = false;
    };
  }, [supabase]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setAviso(null);
    const { error } = await supabase
      .from("configuracoes")
      .update({
        nome_app: nomeApp.trim() || "Mapa de Estoque",
        subtitulo_app: subtituloApp.trim() || "",
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", 1);
    setSalvando(false);

    if (error) {
      setErro(
        "Não consegui salvar — falta rodar no Supabase: alter table configuracoes add column if not exists nome_app text, add column if not exists subtitulo_app text;"
      );
      return;
    }
    setAviso("Salvo! Atualizando a tela…");
    setTimeout(() => window.location.reload(), 700);
  }

  async function mudarRole(id: string, novoRole: "admin" | "operador") {
    setPerfis((prev) => prev.map((p) => (p.id === id ? { ...p, role: novoRole } : p)));
    await supabase.from("perfis").update({ role: novoRole }).eq("id", id);
  }

  const classeInput =
    "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent";

  return (
    <RequerAdmin>
    <div>
      <PageHeader titulo="Configurações" subtitulo="Nome do sistema, logo, fundo de tela e permissões." />

      <Card className="mb-4">
        <h2 className="mb-4 font-display text-base font-semibold tracking-wide text-ink">
          NOME DO SISTEMA
        </h2>
        {carregando ? (
          <p className="text-sm text-ink-dim">Carregando…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm text-ink-dim">Nome principal</span>
              <input value={nomeApp} onChange={(e) => setNomeApp(e.target.value)} placeholder="Mapa de Estoque" className={classeInput} />
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm text-ink-dim">Subtítulo (empresa/equipe)</span>
              <input value={subtituloApp} onChange={(e) => setSubtituloApp(e.target.value)} placeholder="BFR Fanáticos" className={classeInput} />
            </label>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-dim">
          Aparece no menu, na tela de login e nos relatórios impressos (Mapa impresso e Etiquetas).
        </p>
        {erro && <p className="mt-3 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">{erro}</p>}
        {aviso && <p className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{aviso}</p>}
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
