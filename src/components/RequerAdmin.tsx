"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";

export default function RequerAdmin({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checando" | "liberado" | "negado">("checando");

  useEffect(() => {
    let ativo = true;
    const supabase = createClient();

    async function checar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfil } = await supabase.from("perfis").select("role").eq("id", user.id).maybeSingle();
      if (!ativo) return;
      setStatus((perfil?.role as string | undefined) === "admin" ? "liberado" : "negado");
    }

    checar();
    return () => {
      ativo = false;
    };
  }, []);

  if (status === "checando") {
    return <p className="text-sm text-ink-dim">Carregando…</p>;
  }

  if (status === "negado") {
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
