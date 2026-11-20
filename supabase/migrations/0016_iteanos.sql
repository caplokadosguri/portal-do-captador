-- Doadores do ITA: marcação na ficha (turma e apelido, conferidos na Wikita) e versão "Iteano"
-- das mensagens dos checkpoints (versão 4). Semestral passa a "seu 1 ano e meio" / "seus 2 anos".
alter table relacionamento add column if not exists iteano boolean not null default false;
alter table relacionamento add column if not exists turma_ita text;
alter table relacionamento add column if not exists apelido_ita text;

alter table contatos drop constraint if exists contatos_versao_check;
alter table contatos add constraint contatos_versao_check check (versao between 1 and 4);

-- {seu_tempo} = "seu 1 ano e meio", "seus 2 anos"...
update modelos_mensagem
set variacoes = replace(variacoes::text, 'comemorar com você {tempo}', 'comemorar {seu_tempo}')::jsonb,
    partes = replace(partes::text, 'comemorar com você {tempo}', 'comemorar {seu_tempo}')::jsonb,
    texto = replace(texto, 'comemorar com você {tempo}', 'comemorar {seu_tempo}')
where chave = 'semestral';

-- Versão Iteano: a versão 1 com a saudação trocada.
update modelos_mensagem
set variacoes = variacoes || jsonb_build_object('4', jsonb_build_object(
  'm', jsonb_set(variacoes->'1'->'m', '{0,texto}', to_jsonb('Saudações Iteanas, {apelido}, seu bixo da T30 e diretor de captação do CASD aqui!'::text)),
  'f', jsonb_set(variacoes->'1'->'f', '{0,texto}', to_jsonb('Saudações Iteanas, {apelido}, seu bixo da T30 e diretor de captação do CASD aqui!'::text))))
where variacoes is not null and not variacoes ? '4';
