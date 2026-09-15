export async function comprimirImagem(arquivo: File, tamanho = 320): Promise<string> {
  const bitmap = await createImageBitmap(arquivo);
  const canvas = document.createElement("canvas");
  canvas.width = tamanho;
  canvas.height = tamanho;
  const ctx = canvas.getContext("2d")!;

  const escala = Math.max(tamanho / bitmap.width, tamanho / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (tamanho - w) / 2, (tamanho - h) / 2, w, h);

  return canvas.toDataURL("image/jpeg", 0.82);
}
