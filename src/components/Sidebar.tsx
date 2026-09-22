"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoUploader from "@/components/LogoUploader";
import TrocarFundo from "@/components/TrocarFundo";
import {
  IconAlertTriangle,
  IconBarcode,
  IconChartBar,
  IconClipboardCheck,
  IconHistory,
  IconLayoutGrid,
  IconLogout,
  IconMenu2,
  IconPackageImport,
  IconPrinter,
  IconSearch,
  IconSettings,
  IconSettings2,
} from "@tabler/icons-react";

type Papel = "admin" | "operador";

const ITENS_TODOS = [
  { href: "/", rotulo: "Mapa", icone: IconLayoutGrid },
  { href: "/dashboard", rotulo: "Dashboard", icone: IconChartBar },
  { href: "/bipar", rotulo: "Bipar", icone: IconBarcode },
  { href: "/buscar", rotulo: "Buscar produto", icone: IconSearch },
  { href: "/inventario", rotulo: "Inventário", icone: IconClipboardCheck },
  { href: "/recebimento", rotulo: "Recebimento", icone: IconPackageImport },
  { href: "/alertas", rotulo: "Alertas", icone: IconAlertTriangle },
  { href: "/historico", rotulo: "Histórico", icone: IconHistory },
  { href: "/historico-inventarios", rotulo: "Histórico de inventários", icone: IconHistory },
  { href: "/giro", rotulo: "Giro de estoque", icone: IconChartBar },
];

const ITENS_ADMIN = [
  { href: "/gerenciar", rotulo: "Gerenciar posições", icone: IconSettings },
  { href: "/etiquetas", rotulo: "Etiquetas / QR", icone: IconPrinter },
  { href: "/mapa-impresso", rotulo: "Mapa impresso", icone: IconPrinter },
  { href: "/configuracoes", rotulo: "Configurações", icone: IconSettings2 },
];

export default function Sidebar({
  nome,
  nomeApp,
  subtituloApp,
  role,
}: {
  nome: string;
  nomeApp: string;
  subtituloApp: string;
  role: Papel;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [aberto, setAberto] = useState(false);

  const itens = role === "admin" ? [...ITENS_TODOS, ...ITENS_ADMIN] : ITENS_TODOS;

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
            {nomeApp.toUpperCase()}
          </p>
          <p className="text-xs text-ink-dim truncate">{subtituloApp}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {itens.map((item) => {
          const ativo = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
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
        <p className="mb-1 truncate px-1 text-xs text-ink-dim">
          {nome} {role === "operador" && <span className="text-ink-dim">· operador</span>}
        </p>
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
          <span className="truncate font-display text-sm font-semibold tracking-wide">{nomeApp.toUpperCase()}</span>
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
