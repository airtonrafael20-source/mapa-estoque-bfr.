"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { useRole } from "@/components/RoleContext";

export default function RequerAdmin({ children }: { children: React.ReactNode }) {
  const role = useRole();

  if (role !== "admin") {
    return (
      <Card>
        <p className="mb-2 font-display text-lg font-semibold text-ink">🔒 Acesso restrito</p>
        <p className="text-sm text-ink-dim">
          Essa área é só pra administradores. Se você precisa acessar, fala com quem administra o sistema.
        </p>
        <Link href="/" className="mt-3 inline-block text-sm text-accent underline underline-offset-2">
          Voltar pro Mapa
        </Link>
      </Card>
    );
  }

  return <>{children}</>;
}
