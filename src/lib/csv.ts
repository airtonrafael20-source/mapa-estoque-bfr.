export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: (string | number | null)[][]) {
  const escapar = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const linhasCsv = [cabecalho, ...linhas].map((l) => l.map(escapar).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + linhasCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
