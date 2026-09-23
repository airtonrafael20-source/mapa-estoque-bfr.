"use client";

import { useEffect, useState } from "react";

export default function SplashScreen({ logo, nomeApp }: { logo: string | null; nomeApp: string }) {
  const [visivel, setVisivel] = useState(true);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("splash-visto")) {
      setVisivel(false);
      return;
    }
    const t1 = setTimeout(() => setSaindo(true), 550);
    const t2 = setTimeout(() => {
      setVisivel(false);
      sessionStorage.setItem("splash-visto", "1");
    }, 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visivel) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg transition-opacity duration-300 ${
        saindo ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className="h-20 w-20 animate-[splash-crescer_0.5s_ease-out] rounded-full border-2 border-accent object-cover"
        />
      ) : (
        <div className="h-20 w-20 animate-[splash-crescer_0.5s_ease-out] rounded-full border-2 border-accent bg-surface" />
      )}
      <p className="mt-4 animate-[splash-crescer_0.5s_ease-out] font-display text-sm font-semibold uppercase tracking-widest text-ink-dim">
        {nomeApp}
      </p>
    </div>
  );
}
