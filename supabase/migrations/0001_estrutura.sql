-- Portal do Captador — estrutura inicial (piloto)
-- Rodar uma vez no SQL Editor do Supabase (ou com `supabase db push`).
--
-- Princípios:
--  * Tabelas "espelho" (doadores, doacoes, cobrancas) recebem dados da Trackmob.
--    Só o administrador escreve nelas (pela tela de importação). O portal nunca
--    escreve de volta na Trackmob.
--  * Tabelas de relacionamento (relacionamento, contatos, brindes, trilha_pontual)
--    são do portal e são editadas pelos membros.
--  * Cada membro só enxerga a sua fonte. As regras ficam no banco (RLS), não só na tela.
--  * Nada de CPF, cartão, banco ou endereço.

-- ---------------------------------------------------------------------------
-- Membros e papéis
-- ---------------------------------------------------------------------------

create type papel_t as enum ('admin', 'doadores', 'editais', 'parceiros', 'eventos');

-- O admin cadastra o e-mail do membro antes do primeiro login.
create table membros (
  email      text primary key check (email = lower(email)),
  nome       text not null,
  papel      papel_t not null,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- E-mail do usuário logado (vem do token do Supabase Auth).
create function meu_email() returns text
language sql stable
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create function meu_papel() returns papel_t
language sql stable security definer set search_path = public
as $$ select papel from membros where email = meu_email() and ativo $$;

create function sou_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(meu_papel() = 'admin', false) $$;

-- Verdadeiro para o admin ou para quem tem o papel pedido.
create function posso(p papel_t) returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(meu_papel() in ('admin', p), false) $$;

create function sou_membro() returns boolean
language sql stable security definer set search_path = public
as $$ select meu_papel() is not null $$;

-- ---------------------------------------------------------------------------
-- Espelho da Trackmob (somente leitura para membros)
-- ---------------------------------------------------------------------------

create table doadores (
  id                  text primary key,          -- "ID do doador" da Trackmob
  nome                text,
  email               text,
  celular             text,
  aceita_email        boolean,
  aceita_ligacao      boolean,
  aceita_sms          boolean,
  aceita_whatsapp     boolean,
  aceita_cartas       boolean,
  aceita_mala_direta  boolean,
  importado_em        timestamptz not null default now()
);

create table doacoes (
  id                      text primary key,      -- "ID da doação"
  doador_id               text not null references doadores (id) on delete cascade,
  valor                   numeric(12, 2),
  frequencia              text,
  meio_pagamento          text,
  dia_cobranca            int,
  status                  text,
  status_ultima_cobranca  text,
  ultima_cobranca_paga    date,
  criada_em               date,
  finalizada_em           date,
  campanha                text,
  importado_em            timestamptz not null default now()
);
create index on doacoes (doador_id);

-- Sem chaves estrangeiras: o relatório de cobranças pode chegar antes do de doações.
create table cobrancas (
  id             text primary key,              -- "ID da cobrança"
  doacao_id      text,
  doador_id      text,
  competencia    text,
  vencimento     date,
  pago_em        date,
  status         text,
  mensagem_erro  text,
  valor          numeric(12, 2),
  valor_pago     numeric(12, 2),
  importado_em   timestamptz not null default now()
);
create index on cobrancas (doador_id);
create index on cobrancas (doacao_id, vencimento desc);

-- ---------------------------------------------------------------------------
-- Relacionamento (do portal)
-- ---------------------------------------------------------------------------

create table relacionamento (
  doador_id        text primary key references doadores (id) on delete cascade,
  responsavel      text references membros (email) on update cascade on delete set null,
  proximo_contato  date,
  status_conversa  text check (status_conversa in (
                     'lembrete_1', 'lembrete_2', 'aguardando_resposta', 'nova_mensagem',
                     'em_atendimento', 'contato_humano', 'resolvido')),
  anotacoes        text,
  atualizado_por   text not null default meu_email(),
  atualizado_em    timestamptz not null default now()
);

create table contatos (
  id           uuid primary key default gen_random_uuid(),
  doador_id    text not null references doadores (id) on delete cascade,
  membro       text not null default meu_email(),
  canal        text not null check (canal in ('whatsapp', 'ligacao', 'email', 'sms', 'carta', 'presencial')),
  motivo       text not null check (motivo in ('cobranca', 'plano', 'pontual', 'outro')),
  resultado    text,
  nota         text,
  criado_em    timestamptz not null default now()
);
create index on contatos (doador_id, criado_em desc);

create table brindes (
  id             uuid primary key default gen_random_uuid(),
  doador_id      text not null references doadores (id) on delete cascade,
  checkpoint     text not null,
  item           text,
  status         text not null default 'pendente'
                   check (status in ('pendente', 'preparado', 'enviado', 'entregue', 'em_espera')),
  atualizado_por text not null default meu_email(),
  atualizado_em  timestamptz not null default now(),
  unique (doador_id, checkpoint)
);

create table trilha_pontual (
  doador_id      text primary key references doadores (id) on delete cascade,
  status         text not null default 'agradecido'
                   check (status in ('agradecido', 'impacto_enviado', 'convidado', 'virou_mensal', 'sem_resposta')),
  convites       int not null default 0,
  atualizado_por text not null default meu_email(),
  atualizado_em  timestamptz not null default now()
);

-- Modelos de mensagem por etapa. Variáveis: {nome}, {valor}, {meses}.
create table modelos_mensagem (
  chave   text primary key,
  titulo  text not null,
  texto   text not null
);

-- ---------------------------------------------------------------------------
-- Registros (LGPD e auditoria)
-- ---------------------------------------------------------------------------

create table importacoes (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('doacoes', 'cobrancas', 'doadores')),
  arquivo       text,
  linhas_lidas  int not null,
  linhas_ok     int not null,
  erros         jsonb not null default '[]',
  feito_por     text not null default meu_email(),
  feito_em      timestamptz not null default now()
);

create table acessos (
  id         bigint generated always as identity primary key,
  membro     text not null default meu_email(),
  doador_id  text,
  acao       text not null,
  em         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Editais
-- ---------------------------------------------------------------------------

create table projetos (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  escopo            text,
  quem_pediu        text,
  esfera            text check (esfera in ('CASDvest', 'Casdinho', 'Ambos')),
  publico_atendido  int,
  orcamento         numeric(12, 2),
  status            text not null default 'ideia'
                      check (status in ('ideia', 'em_elaboracao', 'pronto', 'aprovado', 'encerrado')),
  link_documentos   text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create table editais (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  financiador   text,
  link          text,
  prazo         date,
  valor_maximo  numeric(12, 2),
  temas         text,
  status        text not null default 'aberto'
                  check (status in ('aberto', 'inscricao_feita', 'resultado', 'encerrado')),
  criado_em     timestamptz not null default now()
);

create table inscricoes (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references projetos (id) on delete cascade,
  edital_id       uuid not null references editais (id) on delete cascade,
  responsavel     text references membros (email) on update cascade on delete set null,
  status          text not null default 'avaliando'
                    check (status in ('avaliando', 'em_escrita', 'enviada', 'aprovada', 'reprovada')),
  valor_pedido    numeric(12, 2),
  valor_aprovado  numeric(12, 2),
  prazo           date,
  unique (projeto_id, edital_id)
);

-- ---------------------------------------------------------------------------
-- Parceiros e Eventos (estrutura genérica; funil a definir)
-- ---------------------------------------------------------------------------

create table empresas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  setor       text,
  contato     text,
  historico   text,
  criado_em   timestamptz not null default now()
);

create table eventos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  data             date,
  meta_patrocinio  numeric(12, 2),
  cotas            text,
  criado_em        timestamptz not null default now()
);

create table oportunidades (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas (id) on delete cascade,
  evento_id     uuid references eventos (id) on delete set null,
  etapa         text not null default 'mapeada',  -- etapas editáveis depois da reunião
  valor         numeric(12, 2),
  contrapartida text,
  responsavel   text references membros (email) on update cascade on delete set null,
  proximo_passo text,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Regras de acesso (RLS)
-- ---------------------------------------------------------------------------

alter table membros          enable row level security;
alter table doadores         enable row level security;
alter table doacoes          enable row level security;
alter table cobrancas        enable row level security;
alter table relacionamento   enable row level security;
alter table contatos         enable row level security;
alter table brindes          enable row level security;
alter table trilha_pontual   enable row level security;
alter table modelos_mensagem enable row level security;
alter table importacoes      enable row level security;
alter table acessos          enable row level security;
alter table projetos         enable row level security;
alter table editais          enable row level security;
alter table inscricoes       enable row level security;
alter table empresas         enable row level security;
alter table eventos          enable row level security;
alter table oportunidades    enable row level security;

-- Membros: cada um vê a própria linha; o admin vê e edita todas.
create policy membros_ver on membros for select using (email = meu_email() or sou_admin());
create policy membros_admin on membros for all using (sou_admin()) with check (sou_admin());

-- Espelho da Trackmob: leitura para Doadores; escrita só do admin (importação).
create policy doadores_ver on doadores for select using (posso('doadores'));
create policy doadores_admin on doadores for all using (sou_admin()) with check (sou_admin());
create policy doacoes_ver on doacoes for select using (posso('doadores'));
create policy doacoes_admin on doacoes for all using (sou_admin()) with check (sou_admin());
create policy cobrancas_ver on cobrancas for select using (posso('doadores'));
create policy cobrancas_admin on cobrancas for all using (sou_admin()) with check (sou_admin());

-- Relacionamento: o perfil Doadores lê e escreve; apagar é só do admin.
create policy rel_ver on relacionamento for select using (posso('doadores'));
create policy rel_criar on relacionamento for insert with check (posso('doadores'));
create policy rel_editar on relacionamento for update using (posso('doadores')) with check (posso('doadores'));
create policy rel_apagar on relacionamento for delete using (sou_admin());

create policy contatos_ver on contatos for select using (posso('doadores'));
create policy contatos_criar on contatos for insert with check (posso('doadores') and membro = meu_email());
create policy contatos_apagar on contatos for delete using (sou_admin());

create policy brindes_ver on brindes for select using (posso('doadores'));
create policy brindes_criar on brindes for insert with check (posso('doadores'));
create policy brindes_editar on brindes for update using (posso('doadores')) with check (posso('doadores'));
create policy brindes_apagar on brindes for delete using (sou_admin());

create policy pontual_ver on trilha_pontual for select using (posso('doadores'));
create policy pontual_criar on trilha_pontual for insert with check (posso('doadores'));
create policy pontual_editar on trilha_pontual for update using (posso('doadores')) with check (posso('doadores'));
create policy pontual_apagar on trilha_pontual for delete using (sou_admin());

create policy modelos_ver on modelos_mensagem for select using (posso('doadores'));
create policy modelos_admin on modelos_mensagem for all using (sou_admin()) with check (sou_admin());

-- Registros: só o admin lê. Importação é do admin; acesso a ficha é registrado por quem abriu.
create policy importacoes_admin on importacoes for all using (sou_admin()) with check (sou_admin());
create policy acessos_ver on acessos for select using (sou_admin());
create policy acessos_criar on acessos for insert with check (sou_membro() and membro = meu_email());

-- Editais: projetos visíveis para qualquer membro; o perfil Editais edita.
create policy projetos_ver on projetos for select using (sou_membro());
create policy projetos_criar on projetos for insert with check (posso('editais'));
create policy projetos_editar on projetos for update using (posso('editais')) with check (posso('editais'));
create policy projetos_apagar on projetos for delete using (sou_admin());
-- Editais: o admin lança; o perfil Editais acompanha.
create policy editais_ver on editais for select using (posso('editais'));
create policy editais_admin on editais for all using (sou_admin()) with check (sou_admin());
create policy inscricoes_ver on inscricoes for select using (posso('editais'));
create policy inscricoes_criar on inscricoes for insert with check (posso('editais'));
create policy inscricoes_editar on inscricoes for update using (posso('editais')) with check (posso('editais'));
create policy inscricoes_apagar on inscricoes for delete using (sou_admin());

-- Parceiros e Eventos trabalham juntos no funil.
create policy empresas_ver on empresas for select using (posso('parceiros') or posso('eventos'));
create policy empresas_escrever on empresas for insert with check (posso('parceiros') or posso('eventos'));
create policy empresas_editar on empresas for update using (posso('parceiros') or posso('eventos'));
create policy empresas_apagar on empresas for delete using (sou_admin());
create policy eventos_ver on eventos for select using (posso('parceiros') or posso('eventos'));
create policy eventos_escrever on eventos for insert with check (posso('eventos'));
create policy eventos_editar on eventos for update using (posso('eventos'));
create policy eventos_apagar on eventos for delete using (sou_admin());
create policy oport_ver on oportunidades for select using (posso('parceiros') or posso('eventos'));
create policy oport_escrever on oportunidades for insert with check (posso('parceiros') or posso('eventos'));
create policy oport_editar on oportunidades for update using (posso('parceiros') or posso('eventos'));
create policy oport_apagar on oportunidades for delete using (sou_admin());

-- ---------------------------------------------------------------------------
-- Dados iniciais
-- ---------------------------------------------------------------------------

-- Modelos provisórios: o texto final sai da reunião com o marketing.
insert into modelos_mensagem (chave, titulo, texto) values
  ('cobranca', 'Pagamento em atraso (rascunho)',
   'Oi, {nome}! Aqui é da Captação do CASD. Vimos que a sua doação de {valor} não foi processada. Podemos te ajudar a regularizar?'),
  ('cartao_vencido', 'Cartão vencido (rascunho)',
   'Oi, {nome}! Aqui é da Captação do CASD. O cartão cadastrado na sua doação parece ter vencido. Quer que a gente te mande o link para atualizar?'),
  ('checkpoint', 'Checkpoint do plano (rascunho)',
   'Oi, {nome}! Hoje faz {meses} meses que você apoia o CASD. Obrigado por fazer parte disso!'),
  ('pontual_convite', 'Convite para doação mensal (rascunho)',
   'Oi, {nome}! Obrigado pela sua doação ao CASD. Que tal transformar esse apoio em uma doação mensal?');

-- Troque pelo seu e-mail institucional antes de rodar, ou cadastre depois pelo SQL Editor.
-- insert into membros (email, nome, papel) values ('captacao@exemplo.org', 'Diretor de Captação', 'admin');
