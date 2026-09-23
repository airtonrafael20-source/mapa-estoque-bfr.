/**
 * Ponto único de monitoramento de erros do sistema.
 *
 * Hoje só registra no console. Pra ligar de verdade num serviço tipo
 * Sentry (tem plano grátis): crie a conta, pegue o DSN, coloque em
 * NEXT_PUBLIC_MONITORAMENTO_DSN nas variáveis de ambiente da Vercel, e
 * troque o corpo dessa função pela chamada do SDK do serviço escolhido.
 */
export function registrarErro(erro: unknown, contexto?: Record<string, unknown>) {
  const dsn = process.env.NEXT_PUBLIC_MONITORAMENTO_DSN;

  // eslint-disable-next-line no-console
  console.error("[erro capturado]", erro, contexto);

  if (!dsn) return; // sem chave configurada — só loga local mesmo

  // Exemplo de como ficaria com Sentry, depois de `npm install @sentry/nextjs`
  // e configurar o DSN:
  //
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.captureException(erro, { extra: contexto });
}
