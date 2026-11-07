-- Editais: campos pedidos pela diretoria (planilha de gestão do CASD).
-- A tabela ainda está vazia, então dá para reorganizar sem migrar dados.

alter table editais rename column financiador to organizador;
alter table editais rename column valor_maximo to valor;
alter table editais drop column status;
alter table editais drop column temas;

alter table editais
  add column situacao      text not null default 'novo'
    check (situacao in ('novo', 'em_escrita', 'em_analise', 'aprovado', 'nao_aprovado', 'descartado')),
  add column aderencia     text check (aderencia in ('alta', 'media', 'baixa')),
  add column prioridade    text check (prioridade in ('alta', 'media', 'baixa')),
  add column abertura      date,
  add column fonte_recurso text,
  add column abrangencia   text check (abrangencia in ('municipal', 'estadual', 'nacional', 'internacional')),
  add column observacao    text,
  add column criado_por    text default privado.meu_email(),
  add column atualizado_em timestamptz not null default now();

-- Mantém "atualizado_em" certo sem depender da tela.
create function privado.tocar_atualizado_em() returns trigger
language plpgsql set search_path = privado, public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger editais_atualizado before update on editais
  for each row execute function privado.tocar_atualizado_em();
create trigger projetos_atualizado before update on projetos
  for each row execute function privado.tocar_atualizado_em();

-- O perfil Editais lança e atualiza editais; apagar continua só com a diretoria.
create policy editais_criar on editais for insert with check (privado.posso('editais'));
create policy editais_editar on editais for update
  using (privado.posso('editais')) with check (privado.posso('editais'));
