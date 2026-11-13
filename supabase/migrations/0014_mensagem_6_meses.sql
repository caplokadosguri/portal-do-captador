-- Mensagem do marco de 6 meses (primeiro contato do plano), no texto definido pela diretoria.
update modelos_mensagem set partes = '[
  {"rotulo": "Saudação e apresentação", "texto": "Bom dia, {nome}, tudo bem? Me chamo Rafael e sou o diretor de captação do CASD."},
  {"rotulo": "Agradecimento", "texto": "Hoje, nós temos a alegria de comemorar seus 6 meses como doador do curso! Sem pessoas como você, não conseguiríamos transformar as mais de 900 vidas que nós atendemos. Muito obrigado por acreditar em nosso trabalho e fazer parte da família CASD!"}
]'::jsonb
where chave = 'meses_6';

update modelos_mensagem set texto = (select string_agg(p->>'texto', E'\n\n' order by i) from jsonb_array_elements(partes) with ordinality as t(p, i))
where chave = 'meses_6';
