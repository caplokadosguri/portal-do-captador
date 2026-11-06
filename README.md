# Portal do Captador · CASD

Área de trabalho da Captação de Recursos do CASD. Cada membro entra no seu perfil (Doadores, Editais, Parceiros, Eventos) e o diretor de Captação entra como administrador e vê tudo.

O piloto cobre o perfil **Doadores**: importação dos relatórios da Trackmob, situação de pagamento, plano de doadores, trilha dos pontuais, mensagem pronta no WhatsApp e histórico de contatos. Editais, Parceiros e Eventos já têm tabelas no banco e uma tela "em breve".

Especificação completa: https://claude.ai/artifact/KJminLaDe9KfCrHn6812mx

## Como funciona

- **Next.js** (interface) hospedado na **Vercel**; **Supabase** (banco Postgres + login).
- As regras de acesso ficam no banco (Row Level Security): cada membro só recebe os dados do seu perfil, mesmo que alguém mexa na interface.
- A Trackmob é a fonte dos dados financeiros. O portal só lê os relatórios e guarda o relacionamento (anotações, contatos, brindes, trilha dos pontuais).
- Os relatórios são lidos no navegador de quem importa. Só uma lista fechada de colunas vai para o banco (`src/lib/relatorios.ts`); CPF, endereço, banco e cartão são descartados.

## Instalação (uma vez, uns 30 minutos)

Use o e-mail institucional da Captação em todas as contas.

1. **Supabase**: crie um projeto em https://supabase.com (região São Paulo).
   - Em *SQL Editor*, cole e rode `supabase/migrations/0001_estrutura.sql`.
   - Ainda no SQL Editor, cadastre o primeiro administrador:
     ```sql
     insert into membros (email, nome, papel) values ('seu-email@institucional', 'Seu nome', 'admin');
     ```
   - Em *Authentication › URL Configuration*, coloque o endereço do site (da Vercel) em *Site URL* e adicione `https://SEU-SITE/auth/callback` em *Redirect URLs*.
   - Opcional: em *Authentication › Providers*, ative o Google para entrar com a conta institucional.
2. **GitHub**: crie uma organização do CASD e suba este repositório nela.
3. **Vercel**: importe o repositório e preencha as variáveis de ambiente (copie de `.env.example`; os valores estão em *Project Settings › API* no Supabase).
4. Entre no site com o seu e-mail, abra **Administrador › Membros e perfis** e cadastre os membros. Eles entram com o próprio e-mail; quem não estiver cadastrado não vê nada.

## Uso semanal

1. Na Trackmob, exporte em CSV: relatório de doações, relatório de cobranças e relatório de doadores.
2. No portal, **Administrador › Importar relatórios**, nessa ordem. Importar de novo atualiza pelo ID da Trackmob, sem duplicar.

## Onde ajustar

| O quê | Arquivo |
| --- | --- |
| Checkpoints do plano, data de lançamento, valor alto dos pontuais, limite de convites | `src/lib/plano.ts` |
| Colunas importadas de cada relatório | `src/lib/relatorios.ts` |
| Regras de situação de pagamento e motivo de falha | `src/lib/situacao.ts` |
| Textos das mensagens | tabela `modelos_mensagem` no Supabase (variáveis `{nome}`, `{valor}`, `{meses}`) |
| Regras de acesso | `supabase/migrations/0001_estrutura.sql` |

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev                  # http://localhost:3000
npm test                     # regras de negócio, com dados inventados
npm run test:banco           # regras de acesso num Postgres em memória
```

Nunca use dados reais de doadores em testes, exemplos ou issues.

## Pendências do piloto

- Definir o que conta como "1ª renovação" (hoje: 1 mês) e a data de lançamento do plano (`INICIO_DO_PLANO`).
- Textos finais das mensagens e brindes por etapa (reunião com o marketing).
- Confirmar o formato real dos CSVs da Trackmob (separador, datas, valores de status) na primeira importação.
