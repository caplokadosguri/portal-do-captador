-- Aniversário (só dia e mês), indicador de endereço e mensagens do plano em partes.

-- 1) Doadores: só o dia e o mês do nascimento (sem o ano: o portal não sabe a idade)
--    e se há endereço na Trackmob (o endereço em si continua descartado na importação).
alter table doadores
  add column nascimento_dia smallint check (nascimento_dia between 1 and 31),
  add column nascimento_mes smallint check (nascimento_mes between 1 and 12),
  add column tem_endereco boolean;

-- 2) Mensagens em partes, enviadas em ordem pelo WhatsApp (parece conversa, não disparo).
alter table modelos_mensagem
  add column partes jsonb not null default '[]'::jsonb,
  add column ordem int not null default 100;

delete from modelos_mensagem where chave = 'checkpoint';

insert into modelos_mensagem (chave, titulo, ordem, texto, partes) values
('boas_vindas', 'Boas-vindas (1ª doação mensal)', 10, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}, tudo bem? Aqui é {membro}, da equipe de Captação do CASD 😊"},
  {"rotulo": "Agradecimento", "texto": "Vi que você começou a doar {valor} por mês pro cursinho. Muito obrigado! É essa ajuda que mantém as aulas gratuitas pra quem não teria como pagar um pré-vestibular."},
  {"rotulo": "O Plano de Doadores", "texto": "A gente tem um Plano de Doadores pra quem apoia todo mês: em alguns momentos da sua caminhada com o CASD (na primeira renovação, aos 6 meses, quando completar 1 ano e depois a cada 6 meses), eu te mando notícias dos alunos e um agradecimento especial. Em alguns desses momentos tem até um presente 🎁"},
  {"rotulo": "Como vamos falar com você", "texto": "Fora isso, só te procuro se acontecer algum problema com o pagamento, pra te ajudar a resolver. As novidades gerais do cursinho vão pela nossa newsletter, por e-mail."},
  {"rotulo": "Pergunta", "texto": "Posso te incluir no Plano? E pra você é melhor receber por aqui ou por e-mail?"}
]'),
('renovacao_1', '1ª renovação', 20, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}! Aqui é {membro}, da Captação do CASD."},
  {"rotulo": "Agradecimento", "texto": "Sua doação renovou este mês, e isso diz muito pra gente: você não ajudou só uma vez, decidiu ficar. Obrigado de verdade!"},
  {"rotulo": "Brinde", "texto": "Como agradecimento por esse primeiro passo, separamos {brinde} pra você 🎁 Já já te conto como ele chega até você."}
]'),
('meses_6', '6 meses', 30, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}, tudo bem? {membro} aqui, da Captação do CASD."},
  {"rotulo": "Agradecimento", "texto": "Hoje faz 6 meses que você apoia o cursinho todo mês! 🎉 Nesse tempo, sua doação ajudou a manter as aulas, o material e os simulados dos nossos alunos. Obrigado por estar com a gente."},
  {"rotulo": "Brinde", "texto": "Pra comemorar, separamos {brinde} pra você 🎁 Já já te conto como ele chega."}
]'),
('ano_1', '1 ano', 40, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}! Aqui é {membro}, da Captação do CASD."},
  {"rotulo": "Agradecimento", "texto": "Hoje faz 1 ano que você apoia o CASD 💙 Um ano inteiro ajudando estudantes a chegar mais perto da universidade. Obrigado por acreditar na educação junto com a gente!"},
  {"rotulo": "Brinde", "texto": "Pra comemorar, separamos {brinde} pra você 🎁 Já já te conto como ele chega."}
]'),
('semestral', 'A cada 6 meses (depois de 1 ano)', 50, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}, tudo bem? Aqui é {membro}, da Captação do CASD."},
  {"rotulo": "Agradecimento", "texto": "Hoje você completa {tempo} apoiando o CASD! É essa constância que deixa a gente planejar o cursinho com tranquilidade. Muito obrigado."},
  {"rotulo": "Brinde", "texto": "Pra comemorar, separamos {brinde} pra você 🎁 Já já te conto como ele chega."}
]'),
('aniversario', 'Aniversário', 60, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}! Aqui é {membro}, da Captação do CASD."},
  {"rotulo": "Parabéns", "texto": "Feliz aniversário! 🎂 Toda a equipe do cursinho te deseja um ano incrível."},
  {"rotulo": "Agradecimento", "texto": "Obrigado por fazer parte da história de tantos alunos. Aproveita muito o seu dia!"}
]'),
('cobranca', 'Pagamento em atraso', 70, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}, tudo bem? Aqui é {membro}, da Captação do CASD."},
  {"rotulo": "O que aconteceu", "texto": "Vi aqui que a sua doação de {valor} deste mês não foi processada. Às vezes é só alguma coisa com o cartão ou com o banco."},
  {"rotulo": "Ajuda", "texto": "Quer que eu te ajude a resolver? Posso te mandar o link pra atualizar o pagamento."}
]'),
('cartao_vencido', 'Cartão vencido', 80, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}, tudo bem? Aqui é {membro}, da Captação do CASD."},
  {"rotulo": "O que aconteceu", "texto": "Parece que o cartão cadastrado na sua doação venceu, por isso a cobrança deste mês não passou."},
  {"rotulo": "Ajuda", "texto": "Quer que eu te mande o link pra atualizar? É rapidinho."}
]'),
('pontual_convite', 'Convite para doação mensal (pontuais)', 90, '', '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}, tudo bem? Aqui é {membro}, da Captação do CASD."},
  {"rotulo": "Agradecimento", "texto": "Obrigado pela sua doação! Ela já está ajudando nossos alunos na preparação pro vestibular."},
  {"rotulo": "Convite", "texto": "Se fizer sentido pra você, dá pra transformar esse apoio numa doação mensal, de qualquer valor. Quer que eu te mande o link?"}
]')
on conflict (chave) do update set titulo = excluded.titulo, ordem = excluded.ordem, partes = excluded.partes;

-- Texto corrido (compatibilidade): as partes juntas.
update modelos_mensagem set texto = (select string_agg(p->>'texto', E'\n\n' order by i) from jsonb_array_elements(partes) with ordinality as t(p, i))
where jsonb_array_length(partes) > 0;
