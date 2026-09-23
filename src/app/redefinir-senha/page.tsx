"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro("Não consegui salvar a nova senha. O link pode ter expirado — peça um novo em Esqueci minha senha.");
      return;
    }

    setOk(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center font-display text-xl font-semibold text-ink">Nova senha</h1>

        {ok ? (
          <div className="rounded-2xl border border-ok/40 bg-ok/10 p-6 text-center text-ok">
            ✔ Senha atualizada! Entrando…
          </div>
        ) : (
          <form onSubmit={salvar} className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-ink-dim">Nova senha</label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
              />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-sm text-ink-dim">Confirmar nova senha</label>
              <input
                type="password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-ink outline-none focus:border-accent"
              />
            </div>
            {erro && <p className="mb-4 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-alert">{erro}</p>}
            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
