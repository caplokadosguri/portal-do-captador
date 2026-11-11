-- Convite para a primeira doação: fecha com uma pergunta (abre conversa e revela o motivo de não ter concluído).
update modelos_mensagem set partes = '[
  {"rotulo": "Saudação e apresentação", "texto": "Oi, {nome}, tudo bem? Aqui é {membro}, da Captação do CASD 😊"},
  {"rotulo": "Agradecimento", "texto": "Vi que você chegou a se cadastrar na nossa página de doação. Obrigado pelo interesse no cursinho!"},
  {"rotulo": "Pergunta", "texto": "Ficou alguma dúvida sobre a doação, ou aconteceu algum problema na hora de concluir? Se eu puder ajudar, é só me falar."}
]'::jsonb
where chave = 'lead_convite';

update modelos_mensagem set texto = (select string_agg(p->>'texto', E'\n\n' order by i) from jsonb_array_elements(partes) with ordinality as t(p, i))
where chave = 'lead_convite';
