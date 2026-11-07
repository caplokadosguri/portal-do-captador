-- Alinha o portal aos modelos de planilha do CASD:
-- "Monitoramento de Editais" (situações e aderência da planilha) e
-- "Plano de abordagem" (aba "Parcerias e Doações PJ" vira o módulo Parceiros).

-- Editais ---------------------------------------------------------------------
alter table editais drop constraint editais_situacao_check;
alter table editais drop constraint editais_aderencia_check;
update editais set situacao = 'aberto' where situacao not in (
  'em_breve', 'aberto', 'fluxo_continuo', 'em_preparacao', 'aguardando', 'escrevendo',
  'inscrito', 'aprovado', 'concluido', 'desclassificado', 'encerrado', 'descartado');
update editais set aderencia = 'a_revisar' where aderencia = 'baixa';
alter table editais alter column situacao set default 'aberto';
alter table editais add constraint editais_situacao_check check (situacao in (
  'em_breve', 'aberto', 'fluxo_continuo', 'em_preparacao', 'aguardando', 'escrevendo',
  'inscrito', 'aprovado', 'concluido', 'desclassificado', 'encerrado', 'descartado'));
alter table editais add constraint editais_aderencia_check check (aderencia in ('alta', 'media', 'a_revisar'));

alter table editais
  add column responsavel      text,
  add column fonte_divulgacao text,   -- "Fonte (Mais Impacto)": onde o edital foi encontrado
  add column motivo_descarte  text;   -- aba "Descartados"

-- Parceiros: plano de abordagem de pessoas jurídicas ---------------------------
create table parcerias (
  id              uuid primary key default gen_random_uuid(),
  organizacao     text not null,
  pessoa          text,
  cargo           text,
  email           text,
  telefone        text,
  rede_social     text,
  contexto        text,
  canal           text,
  mensagem        text,
  tipo            text,
  responsavel     text,
  contato_1       date,
  contato_2       date,
  contato_3       date,
  contato_4       date,
  ultimo_retorno  text,
  proxima_acao    text,
  status          text not null default 'contato_iniciado' check (status in (
                    'contato_iniciado', 'aguardando_retorno', 'reuniao_marcada', 'proposta_elaboracao',
                    'proposta_enviada', 'proposta_analise', 'parceria_fechada', 'apoio_confirmado',
                    'apoio_recusado', 'encerrado_sem_resposta', 'alimentar_futuro')),
  observacoes     text,
  criado_por      text default privado.meu_email(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

alter table parcerias enable row level security;
create policy parcerias_ver on parcerias for select using (privado.posso('parceiros'));
create policy parcerias_criar on parcerias for insert with check (privado.posso('parceiros'));
create policy parcerias_editar on parcerias for update
  using (privado.posso('parceiros')) with check (privado.posso('parceiros'));
create policy parcerias_apagar on parcerias for delete using (privado.sou_admin());

create trigger parcerias_atualizado before update on parcerias
  for each row execute function privado.tocar_atualizado_em();
