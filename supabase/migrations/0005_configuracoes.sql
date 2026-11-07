-- Configurações do portal editáveis pela diretoria (ex.: ligação com o Drive).
-- Membros leem (a ponte com o Drive precisa saber quais planilhas usar);
-- só o administrador altera.
create table configuracoes (
  chave           text primary key,
  valor           text,
  atualizado_por  text default privado.meu_email(),
  atualizado_em   timestamptz not null default now()
);

alter table configuracoes enable row level security;
create policy configuracoes_ver on configuracoes for select using (privado.sou_membro());
create policy configuracoes_admin on configuracoes for all using (privado.sou_admin()) with check (privado.sou_admin());

create trigger configuracoes_atualizado before update on configuracoes
  for each row execute function privado.tocar_atualizado_em();
