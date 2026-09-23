import { NextRequest, NextResponse } from "next/server";
import { createClient as createClientServer } from "@supabase/supabase-js";
import { createClient as createClientSessao } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { email, nome, role } = await req.json();

  if (!email || !nome) {
    return NextResponse.json({ erro: "Preenche nome e e-mail." }, { status: 400 });
  }

  // Confirma que quem está chamando é admin logado
  const supabaseSessao = await createClientSessao();
  const {
    data: { user },
  } = await supabaseSessao.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  const { data: meuPerfil } = await supabaseSessao.from("perfis").select("role").eq("id", user.id).maybeSingle();
  if (meuPerfil?.role !== "admin") {
    return NextResponse.json({ erro: "Só administradores podem cadastrar gente nova." }, { status: 403 });
  }

  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!chaveServico || !url) {
    return NextResponse.json(
      {
        erro:
          "Falta configurar SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente (pega em Supabase → Settings → API → service_role key) — sem isso não dá pra criar usuário por aqui.",
      },
      { status: 500 }
    );
  }

  const admin = createClientServer(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: novoUsuario, error: erroConvite } = await admin.auth.admin.inviteUserByEmail(email.trim());
  if (erroConvite || !novoUsuario?.user) {
    return NextResponse.json(
      { erro: erroConvite?.message || "Não consegui convidar esse e-mail (talvez já exista uma conta com ele)." },
      { status: 400 }
    );
  }

  await admin.from("perfis").insert({
    id: novoUsuario.user.id,
    nome: nome.trim(),
    email: email.trim(),
    role: role === "admin" ? "admin" : "operador",
  });

  return NextResponse.json({ ok: true });
}
