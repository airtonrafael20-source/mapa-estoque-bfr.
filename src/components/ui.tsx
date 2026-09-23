export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  titulo,
  subtitulo,
  acao,
  ajuda,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: React.ReactNode;
  ajuda?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold tracking-wide text-ink break-words sm:text-3xl">
          {titulo}
          {ajuda}
        </h1>
        {subtitulo && <p className="mt-1 text-sm text-ink-dim break-words">{subtitulo}</p>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
