# Mapa de Estoque — BFR Fanáticos

Mapa de localização de produtos no almoxarifado, em tempo real: cada coluna
(A-1, A-2, B-1...) tem 5 andares, cada andar guarda um produto+tamanho com
capacidade e quantidade atual. Cada posição tem um QR code próprio — aponta
a câmera do celular e abre direto a tela daquela posição pra ajustar a
quantidade, sem digitar nada.

Stack: Next.js 16 + Supabase (banco + autenticação + tempo real) + Vercel.
Projeto Supabase **próprio e dedicado** — não compartilha banco com
nenhum outro sistema (loja BFR Fanáticos, SistemaOPS ERP, etc.).

## 1. Banco de dados

1. No projeto Supabase novo que você criou pro mapa de estoque, vá em
   **SQL Editor** → New query → cole todo o conteúdo de `sql/schema.sql`
   → **Run**.
2. **Project Settings → API** → copie o `Project URL` e a chave `anon
   public`.
3. **Authentication → Users → Add user** → crie seu login (e de quem
   mais for mexer no estoque).

Não precisa mexer em "Exposed schemas" — como é projeto próprio, o
schema `public` já vem liberado por padrão.

## 2. Subir para o GitHub

    cd mapa-estoque-bfr
    git init
    git add .
    git commit -m "Mapa de estoque BFR Fanáticos"

Crie um repositório novo no GitHub e envie (ou faça upload manual da
pasta pela interface do site).

## 3. Publicar na Vercel

1. **New Project** → importe o repositório.
2. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Deploy**.

## Como usar no dia a dia

1. Vá em **Gerenciar posições** e cadastre cada coluna/andar com o produto,
   tamanho, capacidade (40 por padrão) e quantidade inicial. As posições
   ficam organizadas por Rua (A, B, C...) automaticamente.
2. Vá em **Etiquetas / QR** e clique em **Imprimir etiquetas** — sai uma
   folha com um QR code por posição. Recorta e cola em cada cesto.
3. No dia a dia: aponta a câmera do celular pro QR do cesto → abre a tela
   daquela posição → toca em **Retirar** ou **Repor** (ou digita a
   quantidade exata) → atualiza na hora pra quem estiver olhando o
   **Mapa**.
4. Use **Buscar produto** pra achar rápido onde está um item específico.

## Rodando localmente (opcional)

    cp .env.local.example .env.local   # preencha com os valores do Supabase
    npm install
    npm run dev
