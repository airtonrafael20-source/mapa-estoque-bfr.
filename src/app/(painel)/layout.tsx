import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome")
    .eq("id", user.id)
    .maybeSingle();

  const { data: config } = await supabase.from("configuracoes").select("fundo_base64").eq("id", 1).maybeSingle();

  const nome = perfil?.nome ?? user.email ?? "Usuário";
  const fundo = config?.fundo_base64 as string | null | undefined;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-bg lg:flex-row">
      {fundo && (
        <>
          <div
            className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${fundo})` }}
          />
          <div className="fixed inset-0 -z-10 bg-bg/85" />
        </>
      )}
      <Sidebar nome={nome} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 print:p-0 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
