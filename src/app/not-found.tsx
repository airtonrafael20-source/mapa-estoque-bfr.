import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <span className="text-6xl" aria-hidden>
        🧭
      </span>
      <h1 className="font-display text-2xl font-bold text-ink">Página não encontrada</h1>
      <p className="max-w-sm text-ink-dim">
        Esse endereço não existe ou foi movido. Confere o link, ou volta pro início.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition hover:brightness-110"
      >
        Voltar pro Mapa
      </Link>
    </main>
  );
}
