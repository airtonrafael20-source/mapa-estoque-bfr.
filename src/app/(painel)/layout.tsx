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

  const nome = perfil?.nome ?? user.email ?? "Usuário";

  return (
    <div className="flex min-h-screen w-full flex-col bg-bg lg:flex-row">
      <Sidebar nome={nome} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 print:p-0 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
