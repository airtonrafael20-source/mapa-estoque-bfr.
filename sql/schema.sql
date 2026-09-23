-- ============================================================
-- MAPA DE ESTOQUE — BFR FANÁTICOS / BOTAFOGO STORE
-- Projeto Supabase próprio e dedicado (não compartilhado com
-- nenhum outro sistema) — tudo fica no schema "public" padrão.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Perfis (um por usuário autenticado)
-- ------------------------------------------------------------
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  criado_em timestamptz not null default now()
);

alter table perfis enable row level security;
create policy "perfis_select" on perfis for select to authenticated using (true);
create policy "perfis_update" on perfis for update to authenticated using (auth.uid() = id);

create or replace function criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into perfis (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure criar_perfil_novo_usuario();

-- ------------------------------------------------------------
-- Locais — suporte a mais de um galpão/depósito.
-- ------------------------------------------------------------
create table if not exists locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

alter table locais enable row level security;
create policy "locais_all" on locais for all to authenticated using (true) with check (true);

insert into locais (nome)
select 'Botafogo Store — Nilton Santos'
where not exists (select 1 from locais);

-- ------------------------------------------------------------
-- Posições — cada coluna (A-1, A-2, B-1...) tem 5 andares, e
-- cada andar guarda um produto+tamanho com capacidade e
-- quantidade atual. O layout pode ser editado quando quiser.
-- ------------------------------------------------------------
create table if not exists posicoes (
  id uuid primary key default gen_random_uuid(),
  local_id uuid references locais(id),
  codigo_coluna text not null,          -- ex: "A-1"
  andar integer not null check (andar between 1 and 5),
  produto text,                          -- ex: "Camisa Masc Home Mizuno 26/27"
  tamanho text,                          -- ex: "P", "M", "GG", "2GG"
  quantidade_atual integer not null default 0,
  capacidade integer not null default 40,
  observacoes text,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  unique (codigo_coluna, andar)
);

create index if not exists idx_posicoes_produto on posicoes (produto);

alter table posicoes enable row level security;
create policy "posicoes_all" on posicoes for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table posicoes;

-- ------------------------------------------------------------
-- Movimentações — histórico de retiradas/reposições/ajustes
-- ------------------------------------------------------------
create table if not exists movimentacoes (
  id uuid primary key default gen_random_uuid(),
  posicao_id uuid not null references posicoes(id) on delete cascade,
  tipo text not null check (tipo in ('retirada','reposicao','ajuste')),
  quantidade integer not null,
  quantidade_resultante integer not null,
  responsavel_nome text not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_mov_posicao on movimentacoes (posicao_id, criado_em desc);

alter table movimentacoes enable row level security;
create policy "mov_all" on movimentacoes for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table movimentacoes;

-- ============================================================
-- Não precisa mexer em "Exposed schemas" — "public" já vem
-- liberado por padrão em projeto novo.
-- Só falta: Authentication → Users → Add user (seu login).
-- ============================================================

-- ------------------------------------------------------------
-- Código de barras do produto + cestos com 6 espaços (era 5)
-- ------------------------------------------------------------
alter table posicoes
  add column if not exists codigo_barras text;

create index if not exists idx_posicoes_codigo_barras on posicoes (codigo_barras);

alter table posicoes
  drop constraint if exists posicoes_andar_check;
alter table posicoes
  add constraint posicoes_andar_check check (andar between 1 and 6);

-- ------------------------------------------------------------
-- Marca e ano do produto
-- ------------------------------------------------------------
alter table posicoes
  add column if not exists marca text,
  add column if not exists ano text;

-- ------------------------------------------------------------
-- Logo do app (editável, igual ao painel operacional)
-- ------------------------------------------------------------
create table if not exists configuracoes (
  id integer primary key default 1,
  logo_base64 text,
  atualizado_em timestamptz not null default now(),
  constraint configuracoes_linha_unica check (id = 1)
);

insert into configuracoes (id) values (1) on conflict (id) do nothing;

alter table configuracoes enable row level security;
create policy "config_select" on configuracoes for select to anon, authenticated using (true);
create policy "config_update" on configuracoes for update to authenticated using (true) with check (true);
grant all on configuracoes to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- QR sem login: permite ajustar a quantidade direto pela
-- posição sem precisar estar autenticado. Fica restrito a
-- ajustar quantidade (update) e registrar o movimento (insert)
-- — continua sem permitir excluir posições ou ver outras telas
-- sem login, já que Mapa/Gerenciar/Buscar continuam exigindo
-- login pelo proxy.ts.
-- ------------------------------------------------------------
create policy "posicoes_select_anon" on posicoes for select to anon using (true);
create policy "posicoes_update_anon" on posicoes for update to anon using (true) with check (true);
create policy "mov_insert_anon" on movimentacoes for insert to anon with check (true);
grant select, update on posicoes to anon;
grant select, insert on movimentacoes to anon;

-- ------------------------------------------------------------
-- Imagem do produto por posição
-- ------------------------------------------------------------
alter table posicoes
  add column if not exists imagem_base64 text;

-- ------------------------------------------------------------
-- Fundo de tela editável (imagem de fundo do painel)
-- ------------------------------------------------------------
alter table configuracoes
  add column if not exists fundo_base64 text;

-- ------------------------------------------------------------
-- Calculadora de ergonomia/tempo de picking
-- ------------------------------------------------------------
alter table posicoes
  add column if not exists peso_unitario_kg numeric,
  add column if not exists distancia_metros numeric;

-- ------------------------------------------------------------
-- Nome do app editável (aparece no menu, login e relatórios)
-- ------------------------------------------------------------
alter table configuracoes
  add column if not exists nome_app text,
  add column if not exists subtitulo_app text;

-- ============================================================
-- LEVA GRANDE: histórico, permissões, recebimento, alertas,
-- observações, itens parados, curva ABC
-- ============================================================

-- ------------------------------------------------------------
-- Permissões (admin / operador). Todo mundo começa como admin
-- pra ninguém ficar trancado fora sem querer — você muda quem
-- for operador depois, em Configurações → Usuários.
-- ------------------------------------------------------------
alter table perfis
  add column if not exists role text not null default 'admin' check (role in ('admin','operador'));

-- ------------------------------------------------------------
-- Recebimento de mercadoria: novo tipo de movimentação +
-- campos de fornecedor/nota
-- ------------------------------------------------------------
alter table movimentacoes
  drop constraint if exists movimentacoes_tipo_check;
alter table movimentacoes
  add constraint movimentacoes_tipo_check check (tipo in ('retirada','reposicao','ajuste','entrada'));
alter table movimentacoes
  add column if not exists fornecedor text,
  add column if not exists numero_nota text;

-- ------------------------------------------------------------
-- Estoque mínimo por posição (pra alertas — se não preencher,
-- o sistema usa a mesma regra de "baixo/vazio" que já existe)
-- ------------------------------------------------------------
alter table posicoes
  add column if not exists estoque_minimo integer;

-- ------------------------------------------------------------
-- Excluir posições/locais fica restrito a admin (o resto —
-- ver, criar, ajustar quantidade — continua liberado pra todo
-- mundo autenticado, incluindo operador)
-- ------------------------------------------------------------
drop policy if exists "posicoes_all" on posicoes;
create policy "posicoes_select" on posicoes for select to authenticated using (true);
create policy "posicoes_insert" on posicoes for insert to authenticated with check (true);
create policy "posicoes_update" on posicoes for update to authenticated using (true) with check (true);
create policy "posicoes_delete_admin" on posicoes for delete to authenticated using (
  exists (select 1 from perfis where id = auth.uid() and role = 'admin')
);

drop policy if exists "locais_all" on locais;
create policy "locais_select" on locais for select to authenticated using (true);
create policy "locais_insert" on locais for insert to authenticated with check (true);
create policy "locais_update" on locais for update to authenticated using (true) with check (true);
create policy "locais_delete_admin" on locais for delete to authenticated using (
  exists (select 1 from perfis where id = auth.uid() and role = 'admin')
);

-- perfis: admin consegue ver/mudar o role de todo mundo (pra tela de Usuários)
drop policy if exists "perfis_update" on perfis;
create policy "perfis_update_proprio_ou_admin" on perfis for update to authenticated using (
  auth.uid() = id or exists (select 1 from perfis p2 where p2.id = auth.uid() and p2.role = 'admin')
);

-- ------------------------------------------------------------
-- Branding completo: cor principal + rodapé "desenvolvido por"
-- ------------------------------------------------------------
alter table configuracoes
  add column if not exists cor_principal text,
  add column if not exists rodape_texto text,
  add column if not exists rodape_link text;
