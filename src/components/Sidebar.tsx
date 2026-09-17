"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoUploader from "@/components/LogoUploader";
import TrocarFundo from "@/components/TrocarFundo";
import {
  IconBarcode,
  IconClipboardCheck,
  IconLayoutGrid,
  IconLogout,
  IconMenu2,
  IconPrinter,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react";

const ITENS = [
  { href: "/", rotulo: "Mapa", icone: IconLayoutGrid },
  { href: "/bipar", rotulo: "Bipar", icone: IconBarcode },
  { href: "/buscar", rotulo: "Buscar produto", icone: IconSearch },
  { href: "/inventario", rotulo: "Inventário", icone: IconClipboardCheck },
  { href: "/gerenciar", rotulo: "Gerenciar posições", icone: IconSettings },
  { href: "/etiquetas", rotulo: "Etiquetas / QR", icone: IconPrinter },
  { href: "/mapa-impresso", rotulo: "Mapa impresso", icone: IconPrinter },
];

export default function Sidebar({ nome }: { nome: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const conteudoNav = (
    <>
      <div className="mb-6 flex items-center gap-3 px-1">
        <LogoUploader tamanho={40} />
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold tracking-wide text-ink truncate">
            MAPA DE ESTOQUE
          </p>
          <p className="text-xs text-ink-dim truncate">BFR Fanáticos</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {ITENS.map((item) => {
          const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icone = item.icone;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                ativo
                  ? "bg-accent text-accent-ink font-semibold"
                  : "text-ink-dim hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icone size={18} aria-hidden />
              <span className="truncate">{item.rotulo}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <p className="mb-1 truncate px-1 text-xs text-ink-dim">{nome}</p>
        <TrocarFundo />
        <button
          onClick={sair}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-ink-dim transition hover:border-alert hover:text-alert"
        >
          <IconLogout size={16} aria-hidden />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 print:hidden lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <LogoUploader tamanho={32} editavel={false} />
          <span className="truncate font-display text-sm font-semibold tracking-wide">MAPA DE ESTOQUE</span>
        </div>
        <button
          onClick={() => setAberto(true)}
          className="shrink-0 rounded-md border border-border p-2 text-ink-dim"
          aria-label="Abrir menu"
        >
          <IconMenu2 size={20} />
        </button>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-surface p-4">
            {conteudoNav}
          </div>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface p-4 print:hidden lg:flex">
        {conteudoNav}
      </aside>
    </>
  );
}
