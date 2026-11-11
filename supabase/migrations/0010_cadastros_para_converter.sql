-- Cadastros sem doação (leads): data do cadastro, motivo de contato próprio e mensagem de convite.

alter table doadores add column cadastrado_em date;

alter table contatos drop constraint contatos_motivo_check;
alter table contatos add constraint contatos_motivo_check check (motivo in ('cobranca', 'plano', 'pontual', 'lead', 'outro'));

insert into modelos_mensagem (chave, titulo, ordem, texto, partes) values
('lead_convite', 'Convite para a primeira doação (cadastros)', 95, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}, tudo bem? Aqui é {membro}, da Captação do CASD 😊"},
  {"rotulo": "Contexto", "texto": "Vi que você se cadastrou na nossa página de doação. Obrigado pelo interesse no cursinho!"},
  {"rotulo": "Convite", "texto": "Se ainda fizer sentido pra você, posso te mandar o link pra concluir sua doação? Qualquer valor ajuda a manter as aulas gratuitas pra quem não pode pagar um pré-vestibular."}
]')
on conflict (chave) do update set titulo = excluded.titulo, ordem = excluded.ordem, partes = excluded.partes;

update modelos_mensagem set texto = (select string_agg(p->>'texto', E'\n\n' order by i) from jsonb_array_elements(partes) with ordinality as t(p, i))
where chave = 'lead_convite';
