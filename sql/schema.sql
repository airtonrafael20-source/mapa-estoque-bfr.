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
