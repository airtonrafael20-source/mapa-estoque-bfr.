"use client";

import { useEffect } from "react";

function corDeTexto(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#16150d";
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? "#16150d" : "#ffffff";
}

export default function ThemeApplier({ corPrincipal }: { corPrincipal: string | null }) {
  useEffect(() => {
    if (corPrincipal) {
      document.documentElement.style.setProperty("--accent", corPrincipal);
      document.documentElement.style.setProperty("--accent-ink", corDeTexto(corPrincipal));
    }

    const salvo = localStorage.getItem("tema");
    if (salvo === "light" || salvo === "dark") {
      document.documentElement.setAttribute("data-theme", salvo);
    }
  }, [corPrincipal]);

  return null;
}

export function alternarTema() {
  const atual = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const novo = atual === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", novo);
  localStorage.setItem("tema", novo);
  return novo;
}

export function temaAtual(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
