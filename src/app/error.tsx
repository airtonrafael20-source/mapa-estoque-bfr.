"use client";

import { useEffect } from "react";
import { registrarErro } from "@/lib/monitoramento";

export default function ErroGeral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    registrarErro(error, { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <span className="text-6xl" aria-hidden>
        ⚠️
      </span>
      <h1 className="font-display text-2xl font-bold text-ink">Algo deu errado</h1>
      <p className="max-w-sm text-ink-dim">
        Não conseguimos carregar essa parte do sistema. Tenta de novo — se continuar, avisa o administrador.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:brightness-110"
      >
        Tentar de novo
      </button>
    </main>
  );
}
