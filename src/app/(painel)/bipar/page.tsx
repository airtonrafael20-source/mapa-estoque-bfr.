"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Posicao, compararColunas, descricaoProduto } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";

type Estado = "lendo" | "buscando" | "nao_encontrado" | "erro_camera";

export default function BiparPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const divRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const processandoRef = useRef(false);

  const [estado, setEstado] = useState<Estado>("lendo");
  const [codigoLido, setCodigoLido] = useState("");
  const [opcoes, setOpcoes] = useState<Posicao[]>([]);
  const [entradaLeitor, setEntradaLeitor] = useState("");
  const inputLeitorRef = useRef<HTMLInputElement>(null);
  const cameraAtivaRef = useRef(false);

  async function pararCameraComSeguranca() {
    if (!cameraAtivaRef.current || !scannerRef.current) return;
    cameraAtivaRef.current = false;
    try {
      await scannerRef.current.stop();
    } catch {
      /* já parada ou nunca chegou a rodar */
    }
    try {
      scannerRef.current.clear();
    } catch {
      /* nada pra limpar */
    }
  }

  useEffect(() => {
    let ativo = true;

    async function iniciar() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!ativo || !divRef.current) return;

      const scanner = new Html5Qrcode(divRef.current.id, {
        formatsToSupport: undefined, // aceita QR e a maioria dos códigos de barras (EAN-13, Code128...)
        verbose: false,
      });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          async (textoLido) => {
            if (processandoRef.current) return;
            processandoRef.current = true;
            await tratarLeitura(textoLido);
            processandoRef.current = false;
          },
          () => {
            /* frame sem leitura — ignora */
          }
        );
        if (ativo) {
          cameraAtivaRef.current = true;
        } else {
          // o componente já foi desmontado antes da câmera terminar de ligar — desliga na hora
          pararCameraComSeguranca();
        }
      } catch {
        if (ativo) setEstado("erro_camera");
      }
    }

    iniciar();

    return () => {
      ativo = false;
      pararCameraComSeguranca();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pararCamera() {
    await pararCameraComSeguranca();
  }

  useEffect(() => {
    inputLeitorRef.current?.focus();
  }, [estado]);

  async function aoSubmeterLeitor(e: React.FormEvent) {
    e.preventDefault();
    const valor = entradaLeitor.trim();
    setEntradaLeitor("");
    if (!valor || processandoRef.current) return;
    processandoRef.current = true;
    await tratarLeitura(valor);
    processandoRef.current = false;
  }

  async function tratarLeitura(texto: string) {
    // Se for o QR de uma posição nossa (contém /posicao/), navega direto pra lá.
    const marcador = "/posicao/";
    const indice = texto.indexOf(marcador);
    if (indice !== -1) {
      await pararCamera();
      router.push(texto.slice(indice));
      return;
    }

    // Senão, trata como código de barras do produto — busca no banco.
    setEstado("buscando");
    setCodigoLido(texto);

    const { data } = await supabase
      .from("posicoes")
      .select("*")
      .eq("codigo_barras", texto.trim())
      .order("codigo_coluna", { ascending: true })
      .order("andar", { ascending: true });

    const encontradas = (data as Posicao[]) ?? [];

    if (encontradas.length === 1) {
      await pararCamera();
      router.push(`/posicao/${encodeURIComponent(encontradas[0].codigo_coluna)}/${encontradas[0].andar}`);
      return;
    }

    if (encontradas.length > 1) {
      await pararCamera();
      const ordenadas = [...encontradas].sort(
        (a, b) => compararColunas(a.codigo_coluna, b.codigo_coluna) || a.andar - b.andar
      );
      setOpcoes(ordenadas);
      setEstado("nao_encontrado"); // reaproveita a tela pra listar as opções
      return;
    }

    await pararCamera();
    setOpcoes([]);
    setEstado("nao_encontrado");
  }

  async function tentarDeNovo() {
    setEstado("lendo");
    setOpcoes([]);
    processandoRef.current = false;
    const { Html5Qrcode } = await import("html5-qrcode");
    if (!divRef.current) return;
    const scanner = new Html5Qrcode(divRef.current.id);
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        async (textoLido) => {
          if (processandoRef.current) return;
          processandoRef.current = true;
          await tratarLeitura(textoLido);
          processandoRef.current = false;
        },
        () => {}
      );
      cameraAtivaRef.current = true;
    } catch {
      setEstado("erro_camera");
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Bipar"
        subtitulo="Aponte pro QR do cesto/produto com a câmera, ou bipe com um leitor físico USB/Bluetooth."
      />

      <Card>
        <div
          id="leitor-camera"
          ref={divRef}
          className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-black"
          style={{ minHeight: estado === "lendo" ? 260 : 0 }}
        />

        <form onSubmit={aoSubmeterLeitor} className="mx-auto mt-4 w-full max-w-sm">
          <label className="mb-1.5 block text-center text-xs text-ink-dim">
            Ou bipe com leitor de código de barras USB/Bluetooth
          </label>
          <input
            ref={inputLeitorRef}
            value={entradaLeitor}
            onChange={(e) => setEntradaLeitor(e.target.value)}
            placeholder="Clique aqui e bipe…"
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-center text-ink outline-none focus:border-accent"
          />
        </form>

        {estado === "buscando" && (
          <p className="mt-4 text-center text-ink-dim">Procurando &quot;{codigoLido}&quot;…</p>
        )}

        {estado === "erro_camera" && (
          <div className="mt-4 text-center">
            <p className="text-alert">
              Não consegui acessar a câmera. Confirma se você deu permissão pro navegador usar a câmera.
            </p>
            <button
              onClick={tentarDeNovo}
              className="mt-3 rounded-lg border border-accent px-4 py-2 font-semibold text-accent"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {estado === "nao_encontrado" && (
          <div className="mt-4">
            {opcoes.length === 0 ? (
              <div className="text-center">
                <p className="text-ink-dim">
                  Código <span className="font-mono text-ink">{codigoLido}</span> não está cadastrado em
                  nenhuma posição.
                </p>
                <div className="mt-3 flex justify-center gap-3">
                  <Link href="/gerenciar" className="rounded-lg border border-accent px-4 py-2 font-semibold text-accent">
                    Cadastrar em Gerenciar
                  </Link>
                  <button
                    onClick={tentarDeNovo}
                    className="rounded-lg border border-border px-4 py-2 text-ink-dim"
                  >
                    Ler de novo
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-center text-sm text-ink-dim">
                  Esse código está em mais de uma posição, escolha:
                </p>
                <div className="flex flex-col gap-2">
                  {opcoes.map((p) => (
                    <Link
                      key={p.id}
                      href={`/posicao/${encodeURIComponent(p.codigo_coluna)}/${p.andar}`}
                      className="rounded-lg border border-border px-3 py-2 text-ink hover:border-accent"
                    >
                      {p.codigo_coluna} · Andar {p.andar} — {descricaoProduto(p)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
