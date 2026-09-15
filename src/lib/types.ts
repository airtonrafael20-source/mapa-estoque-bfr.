export interface Local {
  id: string;
  nome: string;
  criado_em: string;
}

export interface Posicao {
  id: string;
  local_id: string | null;
  codigo_coluna: string;
  andar: number;
  produto: string | null;
  tamanho: string | null;
  marca: string | null;
  ano: string | null;
  codigo_barras: string | null;
  quantidade_atual: number;
  capacidade: number;
  observacoes: string | null;
  atualizado_em: string;
  criado_em: string;
}

/** Corredor/rua é a letra antes do traço no código da coluna (A-1 → "A"). */
export function ruaDaColuna(codigoColuna: string): string {
  const parte = codigoColuna.split("-")[0]?.trim();
  return parte || codigoColuna;
}

/** Sugere o próximo código de coluna dentro de uma rua (A-1, A-2 → sugere A-3). */
export function proximaColuna(rua: string, colunasExistentes: string[]): string {
  const numeros = colunasExistentes
    .filter((c) => ruaDaColuna(c).toUpperCase() === rua.toUpperCase())
    .map((c) => parseInt(c.split("-")[1] ?? "0", 10))
    .filter((n) => !isNaN(n));
  const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  return `${rua.toUpperCase()}-${proximo}`;
}

export interface Movimentacao {
  id: string;
  posicao_id: string;
  tipo: "retirada" | "reposicao" | "ajuste";
  quantidade: number;
  quantidade_resultante: number;
  responsavel_nome: string;
  criado_em: string;
}

export function codigoPosicao(p: Pick<Posicao, "codigo_coluna" | "andar">): string {
  return `${p.codigo_coluna}-A${p.andar}`;
}

export function percentualOcupacao(p: Pick<Posicao, "quantidade_atual" | "capacidade">): number {
  if (p.capacidade <= 0) return 0;
  return Math.round((p.quantidade_atual / p.capacidade) * 100);
}

export type NivelOcupacao = "cheio" | "medio" | "baixo" | "vazio";

export function nivelOcupacao(p: Pick<Posicao, "quantidade_atual" | "capacidade">): NivelOcupacao {
  const pct = percentualOcupacao(p);
  if (p.quantidade_atual <= 0) return "vazio";
  if (pct >= 70) return "cheio";
  if (pct >= 30) return "medio";
  return "baixo";
}

export function carinhaOcupacao(nivel: NivelOcupacao): string {
  switch (nivel) {
    case "cheio":
      return "🟢😃";
    case "medio":
      return "🟡😐";
    case "baixo":
      return "🟠😟";
    case "vazio":
      return "🔴😱";
  }
}

export function corOcupacao(nivel: NivelOcupacao): string {
  switch (nivel) {
    case "cheio":
      return "ok";
    case "medio":
      return "pend";
    case "baixo":
      return "alert";
    case "vazio":
      return "alert";
  }
}

export function descricaoProduto(p: Posicao): string {
  if (!p.produto) return "Posição vazia (sem produto atribuído)";
  return p.tamanho ? `${p.produto} — ${p.tamanho}` : p.produto;
}

/** Descrição completa, incluindo marca e ano — usada na etiqueta impressa e na tela de posição. */
export function descricaoCompleta(p: Posicao): string {
  const partes = [p.produto, p.tamanho, p.marca, p.ano].filter(Boolean);
  return partes.length > 0 ? partes.join(" — ") : "Posição vazia (sem produto atribuído)";
}
