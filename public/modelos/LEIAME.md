# Modelos de planilha do CASD

Versões **limpas** (só cabeçalho, fórmulas, cores e listas; sem dados) dos
modelos enviados pela diretoria. Esta pasta é pública, como o repositório:
nunca coloque aqui uma planilha com dados.

| Arquivo | Abas que o portal preenche | Setor |
| --- | --- | --- |
| `editais.xlsx` (Monitoramento de Editais) | Controle de Editais, Descartados, Log semanal (acrescenta uma linha) | Editais |
| `abordagem.xlsx` (Plano de abordagem) | Inadimplentes (bloco do mês atual) | Doadores |
| `abordagem.xlsx` (Plano de abordagem) | Parcerias e Doações PJ | Parceiros |

A aba "Resumo" e a "Leads e Doações PF" não são mexidas.

Como funciona (`src/lib/xlsxModelo.ts`): o portal abre o .xlsx e troca só as
linhas de dados das abas acima, direto no XML. Título, cores, formatação
condicional, listas suspensas, tabelas, logo e as fórmulas do modelo
("Dias restantes", "Ordem") continuam iguais. As colunas são achadas pelo nome
do cabeçalho, então reordenar colunas no modelo não quebra nada.

"Atualizar arquivo do Drive": baixe a planilha do Drive como .xlsx, escolha no
portal e ele devolve o mesmo arquivo com as abas dele atualizadas e o resto
intacto. No Google Planilhas: Arquivo › Importar › Fazer upload ›
"Substituir planilha" (mantém o mesmo link). Antes de atualizar, o portal
confere se o arquivo tem editais ou empresas que ainda não estão nele; se tiver,
pede para usar "Importar do Drive" primeiro.

Para trocar um modelo: gere a versão limpa (sem dados) e substitua o arquivo
aqui, com o mesmo nome.
