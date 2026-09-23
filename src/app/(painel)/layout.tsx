import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import UIFeedbackProvider from "@/components/ui-feedback";
import ThemeApplier from "@/components/ThemeApplier";
import BuscaGlobal from "@/components/BuscaGlobal";
import SplashScreen from "@/components/SplashScreen";
import OnboardingWizard from "@/components/OnboardingWizard";

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
    .select("nome, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: config } = await supabase
    .from("configuracoes")
    .select("fundo_base64, nome_app, subtitulo_app, logo_base64, cor_principal, rodape_texto, rodape_link")
    .eq("id", 1)
    .maybeSingle();

  const { count: totalLocais } = await supabase.from("locais").select("id", { count: "exact", head: true });

  const nome = perfil?.nome ?? user.email ?? "Usuário";
  const role = (perfil?.role as "admin" | "operador" | null) ?? "admin";
  const fundo = config?.fundo_base64 as string | null | undefined;
  const logo = (config?.logo_base64 as string | null) ?? null;
  const corPrincipal = (config?.cor_principal as string | null) ?? null;
  const nomeApp = (config?.nome_app as string | null) || "Mapa de Estoque";
  const subtituloApp = (config?.subtitulo_app as string | null) || "BFR Fanáticos";
  const rodapeTexto = config?.rodape_texto as string | null | undefined;
  const rodapeLink = config?.rodape_link as string | null | undefined;

  return (
    <UIFeedbackProvider>
      <ThemeApplier corPrincipal={corPrincipal} />
      <SplashScreen logo={logo} nomeApp={nomeApp} />
      <BuscaGlobal />
      {role === "admin" && !totalLocais && <OnboardingWizard />}
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
        <Sidebar nome={nome} nomeApp={nomeApp} subtituloApp={subtituloApp} role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 print:p-0 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
          {rodapeTexto && (
            <footer className="border-t border-border px-4 py-3 text-center text-xs text-ink-dim print:hidden">
              {rodapeLink ? (
                <Link href={rodapeLink} target="_blank" className="hover:text-accent hover:underline">
                  {rodapeTexto}
                </Link>
              ) : (
                rodapeTexto
              )}
            </footer>
          )}
        </div>
      </div>
    </UIFeedbackProvider>
  );
}
