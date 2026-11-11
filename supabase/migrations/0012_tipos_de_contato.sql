-- Tipos de contato com o doador: aniversário separado, e o modelo de mensagem usado.
alter table contatos drop constraint contatos_motivo_check;
alter table contatos add constraint contatos_motivo_check
  check (motivo in ('cobranca', 'plano', 'aniversario', 'pontual', 'lead', 'outro'));
alter table contatos add column modelo text;
