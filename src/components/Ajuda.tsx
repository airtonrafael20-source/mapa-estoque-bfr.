"use client";

import { useState } from "react";

export default function Ajuda({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-label="Ajuda"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs font-semibold text-ink-dim hover:border-accent hover:text-accent"
      >
        ?
      </button>
      {aberto && (
        <>
          <button
            aria-label="Fechar"
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-accent/40 bg-surface p-3 text-left text-xs leading-relaxed text-ink shadow-xl">
            {texto}
          </div>
        </>
      )}
    </span>
  );
}
