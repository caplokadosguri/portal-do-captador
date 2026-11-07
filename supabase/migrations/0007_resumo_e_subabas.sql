-- 1. Projetos: campos do resumo de escopo enviado à assessoria de captação.
alter table projetos
  add column objetivo             text,
  add column justificativa        text,
  add column publico_alvo         text,
  add column atividades           text,
  add column cronograma           text,
  add column resultados_esperados text,
  add column responsavel          text,
  add column link_resumo          text,         -- último resumo gerado no Drive
  add column resumo_gerado_em     timestamptz;

-- 2. Eventos: subabas de metas, gastos, patrocinadores e tarefas.
create table evento_metas (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references eventos (id) on delete cascade,
  descricao   text not null,                  -- ex.: público, ingressos vendidos, voluntários
  unidade     text,                           -- ex.: pessoas, ingressos, R$
  alvo        numeric(12, 2),
  atual       numeric(12, 2),
  observacao  text,
  criado_em   timestamptz not null default now()
);

create table evento_gastos (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references eventos (id) on delete cascade,
  descricao     text not null,
  categoria     text,
  fornecedor    text,
  previsto      numeric(12, 2),
  realizado     numeric(12, 2),
  situacao      text not null default 'previsto' check (situacao in ('previsto', 'aprovado', 'pago', 'cancelado')),
  data          date,
  comprovante   text,                         -- link do comprovante no Drive
  criado_em     timestamptz not null default now()
);

create table evento_patrocinadores (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references eventos (id) on delete cascade,
  parceria_id    uuid references parcerias (id) on delete set null,   -- empresa do módulo Parceiros, se houver
  empresa        text not null,
  cota           text,
  valor          numeric(12, 2),
  contrapartidas text,
  situacao       text not null default 'prospectado'
                   check (situacao in ('prospectado', 'em_negociacao', 'confirmado', 'recebido', 'recusado')),
  contato        text,
  observacao     text,
  criado_em      timestamptz not null default now()
);

create table evento_tarefas (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references eventos (id) on delete cascade,
  descricao    text not null,
  responsavel  text,
  prazo        date,
  feita        boolean not null default false,
  criado_em    timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['evento_metas', 'evento_gastos', 'evento_patrocinadores', 'evento_tarefas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create index %I on %I (evento_id)', t || '_evento', t);
    execute format('create policy %I on %I for select using (privado.posso(''eventos''))', t || '_ver', t);
    execute format('create policy %I on %I for insert with check (privado.posso(''eventos''))', t || '_criar', t);
    execute format('create policy %I on %I for update using (privado.posso(''eventos'')) with check (privado.posso(''eventos''))', t || '_editar', t);
    execute format('create policy %I on %I for delete using (privado.posso(''eventos''))', t || '_apagar', t);
  end loop;
end $$;

-- 3. Tabelas do rascunho inicial de Parceiros/Eventos que nunca foram usadas
--    (substituídas por parcerias e evento_patrocinadores). Estavam vazias.
drop table oportunidades;
drop table empresas;
