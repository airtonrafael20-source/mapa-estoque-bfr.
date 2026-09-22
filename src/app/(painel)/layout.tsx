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

  const { data: config } = await supabase
    .from("configuracoes")
    .select("fundo_base64, nome_app, subtitulo_app")
    .eq("id", 1)
    .maybeSingle();

  const nome = perfil?.nome ?? user.email ?? "Usuário";
  const fundo = config?.fundo_base64 as string | null | undefined;
  const nomeApp = (config?.nome_app as string | null) || "Mapa de Estoque";
  const subtituloApp = (config?.subtitulo_app as string | null) || "BFR Fanáticos";

  return (
    <div className={`relative isolate flex min-h-screen w-full flex-col lg:flex-row ${fundo ? "" : "bg-bg"}`}>
      {fundo && (
        <>
          <div
            className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${fundo})` }}
          />
          <div className="fixed inset-0 -z-10 bg-bg/70" />
        </>
      )}
      <Sidebar nome={nome} nomeApp={nomeApp} subtituloApp={subtituloApp} />
      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 print:p-0 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
