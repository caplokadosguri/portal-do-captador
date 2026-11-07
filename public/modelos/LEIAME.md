# Modelos de planilha do CASD

Coloque aqui o modelo de cada setor, **só com o cabeçalho** (sem dados reais:
esta pasta é pública e o repositório também):

- `editais.xlsx`
- `projetos.xlsx`
- `doadores.xlsx`
- `parceiros.xlsx`
- `eventos.xlsx`

O botão "Gerar planilha" de cada tela procura o cabeçalho nas 20 primeiras
linhas da primeira aba, casa as colunas pelo nome (aceita variações como
"Edital", "Financiador", "Data limite", "Valor (R$)") e escreve os dados logo
abaixo, mantendo título, cores e formatação do modelo. Colunas do modelo que o
portal não conhece ficam em branco. Sem modelo, sai uma planilha padrão.
