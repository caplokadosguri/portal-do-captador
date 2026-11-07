# Modelos de planilha do CASD

Versões **limpas** (só cabeçalho, fórmulas, cores e listas; sem dados) dos
modelos enviados pela diretoria. Esta pasta é pública, como o repositório:
nunca coloque aqui uma planilha com dados.

| Arquivo | Abas que o portal preenche | Setor |
| --- | --- | --- |
| `editais.xlsx` (Monitoramento de Editais) | Controle de Editais, Descartados, Log semanal (acrescenta uma linha) | Editais |
| `abordagem.xlsx` (Plano de abordagem) | Inadimplentes (quem está em atraso agora + regularizados nos últimos 60 dias) | Doadores |
| `abordagem.xlsx` (Plano de abordagem) | Parcerias e Doações PJ | Parceiros |
| `projetos.xlsx` (Banco de Projetos) | Projetos (a aba Resumo calcula sozinha) | Projetos |
| `eventos.xlsx` (Calendário de Eventos) | Eventos (a aba Resumo calcula sozinha) | Eventos |

`projetos.xlsx` e `eventos.xlsx` foram criados pelo portal com a identidade dos
outros modelos (`scripts/gerar_modelos.py`). Para usar no Drive: suba o arquivo, abra
e use Arquivo › Salvar como Planilhas Google; o link da versão Google vai em
Início › Planilhas no Drive.

A aba "Resumo" e a "Leads e Doações PF" não são mexidas.

Como funciona (`src/lib/xlsxModelo.ts`): o portal abre o .xlsx e troca só as
linhas de dados das abas acima, direto no XML. Título, cores, formatação
condicional, listas suspensas, tabelas, logo e as fórmulas do modelo
("Dias restantes", "Ordem") continuam iguais. As colunas são achadas pelo nome
do cabeçalho, então reordenar colunas no modelo não quebra nada.

O caminho principal é o Drive: o portal escreve direto nas planilhas ligadas em
Início › Planilhas no Drive (ponte em `src/lib/drive/codigoAppsScript.ts`, com
as mesmas regras). Estes arquivos servem para o "Baixar cópia (.xlsx)".

Para trocar um modelo: gere a versão limpa (sem dados) e substitua o arquivo
aqui, com o mesmo nome.
