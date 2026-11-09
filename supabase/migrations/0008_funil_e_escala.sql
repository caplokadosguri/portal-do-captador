-- Funil de parcerias e escala de membros-de-dia na sede.

-- 1) Parcerias: empresa mapeada ainda sem abordagem + classificação de interesse feita pelo membro.
alter table parcerias drop constraint parcerias_status_check;
alter table parcerias add constraint parcerias_status_check check (status in (
  'a_abordar', 'contato_iniciado', 'aguardando_retorno', 'reuniao_marcada', 'proposta_elaboracao',
  'proposta_enviada', 'proposta_analise', 'parceria_fechada', 'apoio_confirmado',
  'apoio_recusado', 'encerrado_sem_resposta', 'alimentar_futuro'));
alter table parcerias alter column status set default 'a_abordar';
alter table parcerias add column interesse text check (interesse in ('sem_retorno', 'frio', 'morno', 'quente'));

-- 2) Escala da sede: dias em que a Captação precisa ir (vêm da escala do diretor de Gestão)
--    e o membro-de-dia escolhido pelo diretor de Captação. Todos os membros veem; só o admin altera.
create table escala_sede (
  id             uuid primary key default gen_random_uuid(),
  data           date not null,
  periodo        text,
  membro_email   text references membros(email) on update cascade on delete set null,
  diretor_do_dia text,
  observacao     text,
  criado_por     text default privado.meu_email(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index escala_sede_data on escala_sede (data);
create index escala_sede_membro on escala_sede (membro_email, data);

alter table escala_sede enable row level security;
create policy escala_ver on escala_sede for select using (privado.sou_membro());
create policy escala_admin on escala_sede for all using (privado.sou_admin()) with check (privado.sou_admin());

create trigger escala_sede_atualizado before update on escala_sede
  for each row execute function privado.tocar_atualizado_em();
