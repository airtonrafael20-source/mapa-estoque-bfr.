"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LogoUploader from "@/components/LogoUploader";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [nomeApp, setNomeApp] = useState("Mapa de Estoque");
  const [subtituloApp, setSubtituloApp] = useState("BFR Fanáticos");
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState("");
  const [avisoRecuperar, setAvisoRecuperar] = useState<string | null>(null);
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false);

  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("nome_app, subtitulo_app")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nome_app) setNomeApp(data.nome_app as string);
        if (data?.subtitulo_app) setSubtituloApp(data.subtitulo_app as string);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro("E-mail ou senha incorretos.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function enviarRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    setEnviandoRecuperar(true);
    setAvisoRecuperar(null);
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperar.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setEnviandoRecuperar(false);
    setAvisoRecuperar(
      error
        ? "Não consegui enviar — confere o e-mail digitado."
        : "Se esse e-mail existir no sistema, mandamos um link pra redefinir a senha."
    );
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <LogoUploader tamanho={56} editavel={false} />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-ink break-words">
            {nomeApp.toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-ink-dim break-words">{subtituloApp} — acesso restrito</p>
        </div>

        <form
          onSubmit={modoRecuperar ? enviarRecuperacao : entrar}
          className="w-full rounded-2xl border border-border bg-surface p-6"
        >
          {!modoRecuperar ? (
            <>
              <div className="mb-4">
                <label htmlFor="email" className="mb-1.5 block text-sm text-ink-dim">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="mb-2">
                <label htmlFor="senha" className="mb-1.5 block text-sm text-ink-dim">
                  Senha
                </label>
                <input
                  id="senha"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(ev) => setSenha(ev.target.value)}
                  className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setModoRecuperar(true);
                  setAvisoRecuperar(null);
                }}
                className="mb-5 text-xs text-ink-dim underline underline-offset-2"
              >
                Esqueci minha senha
              </button>

              {erro && (
                <p className="mb-4 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert break-words">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
              >
                {carregando ? "Entrando…" : "Entrar"}
              </button>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-ink-dim">
                Digita o e-mail da sua conta — mandamos um link pra você criar uma senha nova.
              </p>
              <div className="mb-4">
                <label htmlFor="email-recuperar" className="mb-1.5 block text-sm text-ink-dim">
                  E-mail
                </label>
                <input
                  id="email-recuperar"
                  type="email"
                  required
                  autoComplete="email"
                  value={emailRecuperar}
                  onChange={(ev) => setEmailRecuperar(ev.target.value)}
                  className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
                />
              </div>

              {avisoRecuperar && (
                <p className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent break-words">
                  {avisoRecuperar}
                </p>
              )}

              <button
                type="submit"
                disabled={enviandoRecuperar}
                className="mb-3 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60"
              >
                {enviandoRecuperar ? "Enviando…" : "Enviar link de recuperação"}
              </button>
              <button
                type="button"
                onClick={() => setModoRecuperar(false)}
                className="w-full text-center text-xs text-ink-dim underline underline-offset-2"
              >
                Voltar pro login
              </button>
            </>
          )}
        </form>
      </div>
    </main>
  );
}
