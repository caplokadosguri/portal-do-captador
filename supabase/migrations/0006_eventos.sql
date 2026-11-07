-- Eventos: calendário da Captação, com datas previstas (ainda especuladas) e
-- tipo do evento: captação (EC), institucional (EI) e aberto (EA).
-- A tabela estava vazia; a estrutura será validada na reunião com o marketing.

alter table eventos rename column data to inicio;
alter table eventos rename column meta_patrocinio to meta;

alter table eventos
  add column fim             date,
  add column previsao        text,       -- como a data foi combinada: "meio de maio", "2º semestre"
  add column data_confirmada boolean not null default false,
  add column tipos           text[] not null default '{}'
    check (tipos <@ array['captacao', 'institucional', 'aberto']::text[]),
  add column frequencia      text not null default 'unico'
    check (frequencia in ('unico', 'recorrente', 'continuo')),
  add column situacao        text not null default 'proposta'
    check (situacao in ('proposta', 'aprovado', 'em_preparacao', 'realizado', 'cancelado')),
  add column local           text,
  add column responsavel     text,
  add column arrecadado      numeric(12, 2),
  add column descricao       text,
  add column link            text,
  add column criado_por      text default privado.meu_email(),
  add column atualizado_em   timestamptz not null default now(),
  add constraint eventos_periodo check (fim is null or inicio is null or fim >= inicio);

create trigger eventos_atualizado before update on eventos
  for each row execute function privado.tocar_atualizado_em();
