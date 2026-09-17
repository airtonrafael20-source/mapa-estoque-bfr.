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
  imagem_base64: string | null;
  quantidade_atual: number;
  capacidade: number;
  observacoes: string | null;
  atualizado_em: string;
  criado_em: string;
}

/** "Rua" agora é o endereço completo (letra + primeiro número): "A-1 C-3" → "A-1". */
export function ruaDaColuna(codigoColuna: string): string {
  const m = codigoColuna.match(/^\s*([A-Za-z]+)\s*-?\s*(\d+)/);
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  return codigoColuna.split("-")[0]?.trim() || codigoColuna;
}

/** Rótulo do cesto dentro do endereço — pega o número que sobra depois do
 *  endereço e mostra como "C1", "C2"... Funciona tanto pro formato novo
 *  ("A-1 C-3") quanto pro antigo ("A-1-3"). Sem número sobrando, é null
 *  (o endereço é o cesto inteiro, sem subdivisão). */
export function cestoLabel(codigoColuna: string): string | null {
  const m = codigoColuna.match(/^\s*[A-Za-z]+\s*-?\s*\d+\s*(?:[-\s]*C?[-\s]*(\d+))?/i);
  if (m && m[1]) return `C${m[1]}`;
  return null;
}

/** Sugere o próximo código de cesto dentro de um endereço (A-1 C-1, A-1 C-2 → sugere A-1 C-3). */
export function proximaColuna(rua: string, colunasExistentes: string[]): string {
  const numeros = colunasExistentes
    .filter((c) => ruaDaColuna(c).toUpperCase() === rua.toUpperCase())
    .map((c) => {
      const m = c.match(/(\d+)\s*$/);
      return m ? parseInt(m[1], 10) : NaN;
    })
    .filter((n) => !isNaN(n));
  const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  return `${rua.toUpperCase()} C-${proximo}`;
}

/** Compara códigos de coluna "naturalmente" — números são comparados como número,
 *  não importa quantos pedaços/traços o código tenha (A-2 < A-10 < A-1-2 < A-1-10). */
export function compararColunas(a: string, b: string): number {
  const tokenize = (s: string) => s.match(/(\d+|\D+)/g) ?? [s];
  const ta = tokenize(a);
  const tb = tokenize(b);
  const tamanho = Math.max(ta.length, tb.length);
  for (let i = 0; i < tamanho; i++) {
    const xa = ta[i] ?? "";
    const xb = tb[i] ?? "";
    const na = Number(xa);
    const nb = Number(xb);
    const ambosNumeros = xa !== "" && xb !== "" && !isNaN(na) && !isNaN(nb);
    if (ambosNumeros) {
      if (na !== nb) return na - nb;
    } else {
      const cmp = xa.localeCompare(xb);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
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
