"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Posicao, descricaoProduto } from "@/lib/types";

const PAGINAS = [
  { href: "/", rotulo: "Mapa" },
  { href: "/dashboard", rotulo: "Dashboard" },
  { href: "/bipar", rotulo: "Bipar" },
  { href: "/buscar", rotulo: "Buscar produto" },
  { href: "/inventario", rotulo: "Inventário" },
  { href: "/recebimento", rotulo: "Recebimento" },
  { href: "/alertas", rotulo: "Alertas" },
  { href: "/historico", rotulo: "Histórico" },
  { href: "/historico-inventarios", rotulo: "Histórico de inventários" },
  { href: "/giro", rotulo: "Giro de estoque" },
  { href: "/gerenciar", rotulo: "Gerenciar posições" },
  { href: "/etiquetas", rotulo: "Etiquetas / QR" },
  { href: "/mapa-impresso", rotulo: "Mapa impresso" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

export default function BuscaGlobal() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((a) => !a);
      }
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    if (aberto && posicoes.length === 0) {
      supabase
        .from("posicoes")
        .select("*")
        .not("produto", "is", null)
        .then(({ data }) => setPosicoes((data as Posicao[]) ?? []));
    }
  }, [aberto, posicoes.length, supabase]);

  const resultadosPaginas = useMemo(() => {
    if (!termo.trim()) return PAGINAS;
    return PAGINAS.filter((p) => p.rotulo.toLowerCase().includes(termo.toLowerCase()));
  }, [termo]);

  const resultadosPosicoes = useMemo(() => {
    if (!termo.trim()) return [];
    const t = termo.toLowerCase();
    return posicoes
      .filter(
        (p) =>
          p.codigo_coluna.toLowerCase().includes(t) ||
          (p.produto ?? "").toLowerCase().includes(t) ||
          (p.codigo_barras ?? "").toLowerCase().includes(t)
      )
      .slice(0, 8);
  }, [termo, posicoes]);

  function ir(href: string) {
    setAberto(false);
    setTermo("");
    router.push(href);
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 px-4 pt-24">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        <input
          autoFocus
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar posição, produto ou página… (Esc pra fechar)"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-ink outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {resultadosPosicoes.length > 0 && (
            <>
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">Posições</p>
              {resultadosPosicoes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => ir(`/posicao/${encodeURIComponent(p.codigo_coluna)}/${p.andar}`)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                >
                  <span className="font-semibold">{p.codigo_coluna}</span> · andar {p.andar} — {descricaoProduto(p)}
                </button>
              ))}
            </>
          )}
          <p className="mt-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">Páginas</p>
          {resultadosPaginas.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-dim">Nada encontrado.</p>
          ) : (
            resultadosPaginas.map((p) => (
              <button
                key={p.href}
                onClick={() => ir(p.href)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
              >
                {p.rotulo}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
