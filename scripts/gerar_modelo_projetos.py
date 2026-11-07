"""Gera public/modelos/projetos.xlsx: o modelo da planilha "Banco de Projetos".

Segue a identidade das planilhas do CASD (Monitoramento de Editais e Plano de
abordagem): logo no topo, título em Arial 14 azul-petróleo, cabeçalho azul
CASD (#3192B3) em Montserrat, linhas alternadas, bordas finas azuis, listas
suspensas e cores por status. Sem nenhum dado.

Uso: python3 scripts/gerar_modelo_projetos.py
"""

from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

RAIZ = Path(__file__).resolve().parent.parent
AZUL, PETROLEO, LARANJA, LISTRA, MARINHO = '3192B3', '1B5973', 'F9B341', 'F6F8F9', '1E4472'
LINHAS = 200  # linhas de dados já formatadas

# Título, largura e formato de cada coluna (a partir da coluna B, como no Plano de abordagem).
COLUNAS = [
    ('Título', 34, None),
    ('Esfera', 18, None),
    ('Status', 20, None),
    ('Escopo', 50, None),
    ('Quem pediu', 20, None),
    ('Público atendido', 14, '#,##0'),
    ('Orçamento', 16, '"R$" #,##0.00'),
    ('Editais vinculados', 34, None),
    ('Link dos documentos', 30, None),
    ('Observações da equipe', 36, None),
]
ESFERAS = ['CASDvest', 'Casdinho', 'CASDvest e Casdinho']
STATUS = ['Ideia', 'Em elaboração', 'Pronto para inscrever', 'Aprovado', 'Encerrado']

fino = Side(style='thin', color=AZUL)
borda = Border(left=fino, right=fino, top=fino, bottom=fino)

wb = Workbook()
ws = wb.active
ws.title = 'Projetos'
ws.sheet_view.showGridLines = False
ws.column_dimensions['A'].width = 3.9
ws.row_dimensions[1].height = 42
ws.row_dimensions[2].height = 30

logo = Image(str(RAIZ / 'scripts' / 'casd-logo-planilha.png'))
logo.width, logo.height = 113, 40
ws.add_image(logo, 'B1')

ws['D1'] = 'Banco de Projetos CASD  |  última atualização: '
ws['D1'].font = Font(name='Arial', size=14, bold=True, color=PETROLEO)
ws['D1'].alignment = Alignment(vertical='center')

ultima_col = 1 + len(COLUNAS)
for i, (titulo, largura, formato) in enumerate(COLUNAS, start=2):
    letra = ws.cell(row=2, column=i).column_letter
    ws.column_dimensions[letra].width = largura
    c = ws.cell(row=2, column=i, value=titulo)
    c.font = Font(name='Montserrat', size=11, bold=True, color='FFFFFF')
    c.fill = PatternFill('solid', fgColor=AZUL)
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    c.border = borda
    for r in range(3, 3 + LINHAS):
        d = ws.cell(row=r, column=i)
        d.font = Font(name='Arial', size=10)
        d.alignment = Alignment(vertical='center', wrap_text=titulo in ('Escopo', 'Observações da equipe', 'Editais vinculados'))
        d.border = borda
        d.fill = PatternFill('solid', fgColor='FFFFFF' if r % 2 else LISTRA)
        if formato:
            d.number_format = formato
for r in range(3, 3 + LINHAS):
    ws.row_dimensions[r].height = 22.5

ws.freeze_panes = 'C3'
fim = 2 + LINHAS
ws.auto_filter.ref = f'B2:{ws.cell(row=2, column=ultima_col).column_letter}{fim}'

lista_esfera = DataValidation(type='list', formula1='"' + ','.join(ESFERAS) + '"', allow_blank=True, showErrorMessage=False)
lista_status = DataValidation(type='list', formula1='"' + ','.join(STATUS) + '"', allow_blank=True, showErrorMessage=False)
ws.add_data_validation(lista_esfera)
ws.add_data_validation(lista_status)
lista_esfera.add(f'C3:C{fim}')
lista_status.add(f'D3:D{fim}')

# Cores: esfera e status (como as cores de prazo e de status das outras planilhas).
cores = [
    ('C', '$C3="CASDvest"', 'D6ECF4', None),
    ('C', '$C3="Casdinho"', 'FDECCB', None),
    ('C', '$C3="CASDvest e Casdinho"', 'D4EFEA', None),
    ('D', '$D3="Pronto para inscrever"', 'CDEBD8', None),
    ('D', '$D3="Aprovado"', '3FA66B', 'FFFFFF'),
    ('D', '$D3="Em elaboração"', 'FFE499', None),
]
for col, formula, fundo, fonte in cores:
    ws.conditional_formatting.add(
        f'{col}3:{col}{fim}',
        FormulaRule(formula=[formula], fill=PatternFill('solid', fgColor=fundo, bgColor=fundo), font=Font(bold=True, color=fonte) if fonte else None),
    )
# Encerrados ficam em cinza, como nos editais.
ws.conditional_formatting.add(
    f'B3:{ws.cell(row=2, column=ultima_col).column_letter}{fim}',
    FormulaRule(formula=['$D3="Encerrado"'], font=Font(color='878787')),
)

# Resumo, no formato da aba Resumo dos editais.
rs = wb.create_sheet('Resumo')
rs.sheet_view.showGridLines = False
rs['A1'] = 'Resumo – Projetos CASD'
rs['A1'].font = Font(name='Arial', size=16, bold=True, color=PETROLEO)
rs['A2'] = '="Atualizado em "&TEXT(TODAY(),"dd/mm/yyyy")'
rs['A2'].font = Font(name='Arial', size=10, color='666666')
rs.column_dimensions['A'].width = 30
for letra in 'BCD':
    rs.column_dimensions[letra].width = 18


def bloco(linha, titulo, itens, coluna_criterio):
    cab = [titulo, 'Projetos', 'Orçamento', 'Público atendido']
    for j, t in enumerate(cab, start=1):
        c = rs.cell(row=linha, column=j, value=t)
        c.font = Font(name='Arial', bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor=MARINHO)
    for k, item in enumerate(itens, start=1):
        r = linha + k
        rs.cell(row=r, column=1, value=item)
        rs.cell(row=r, column=2, value=f"=COUNTIF(Projetos!${coluna_criterio}$3:${coluna_criterio}${fim},A{r})")
        rs.cell(row=r, column=3, value=f"=SUMIF(Projetos!${coluna_criterio}$3:${coluna_criterio}${fim},A{r},Projetos!$H$3:$H${fim})").number_format = '"R$" #,##0.00'
        rs.cell(row=r, column=4, value=f"=SUMIF(Projetos!${coluna_criterio}$3:${coluna_criterio}${fim},A{r},Projetos!$G$3:$G${fim})").number_format = '#,##0'
        for j in range(1, 5):
            rs.cell(row=r, column=j).font = Font(name='Arial', size=10)
            rs.cell(row=r, column=j).fill = PatternFill('solid', fgColor='FFFFFF' if k % 2 else LISTRA)
            rs.cell(row=r, column=j).border = borda
    total = linha + len(itens) + 1
    rs.cell(row=total, column=1, value='Total').font = Font(name='Arial', bold=True)
    rs.cell(row=total, column=2, value=f'=SUM(B{linha + 1}:B{total - 1})').font = Font(name='Arial', bold=True)
    rs.cell(row=total, column=3, value=f'=SUM(C{linha + 1}:C{total - 1})').number_format = '"R$" #,##0.00'
    rs.cell(row=total, column=4, value=f'=SUM(D{linha + 1}:D{total - 1})').number_format = '#,##0'
    return total + 2


proxima = bloco(4, 'Esfera', ESFERAS, 'C')
bloco(proxima, 'Status', STATUS, 'D')

destino = RAIZ / 'public' / 'modelos' / 'projetos.xlsx'
wb.save(destino)
print('gerado', destino)
