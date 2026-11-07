"""Gera os modelos de planilha criados pelo portal, em public/modelos/:
projetos.xlsx (Banco de Projetos) e eventos.xlsx (Calendário de Eventos).

Seguem a identidade das planilhas do CASD (Monitoramento de Editais e Plano de
abordagem): logo no topo, título em Arial 14 azul-petróleo, cabeçalho azul
CASD (#3192B3) em Montserrat, linhas alternadas, bordas finas azuis, listas
suspensas e cores. Sem nenhum dado.

Uso: python3 scripts/gerar_modelos.py
"""

from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

RAIZ = Path(__file__).resolve().parent.parent
AZUL, PETROLEO, LISTRA, MARINHO = '3192B3', '1B5973', 'F6F8F9', '1E4472'
LINHAS = 200  # linhas de dados já formatadas
fino = Side(style='thin', color=AZUL)
borda = Border(left=fino, right=fino, top=fino, bottom=fino)


def gerar(arquivo, aba, titulo, colunas, listas, cores, cinza_se, quebra, resumo):
    """colunas: [(título, largura, formato)]; listas: {título: [opções]};
    cores: [(título, fórmula com {c} = célula da coluna, fundo, fonte)];
    cinza_se: fórmula que deixa a linha cinza;
    resumo: [(título do bloco, coluna do critério, [(rótulo, valor)], [(título, coluna somada)], curinga)]."""
    wb = Workbook()
    ws = wb.active
    ws.title = aba
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 3.9
    ws.row_dimensions[1].height = 42
    ws.row_dimensions[2].height = 30
    logo = Image(str(RAIZ / 'scripts' / 'casd-logo-planilha.png'))
    logo.width, logo.height = 113, 40
    ws.add_image(logo, 'B1')
    ws['D1'] = f'{titulo}  |  última atualização: '
    ws['D1'].font = Font(name='Arial', size=14, bold=True, color=PETROLEO)
    ws['D1'].alignment = Alignment(vertical='center')

    letra = {}
    ultima = 1 + len(colunas)
    fim = 2 + LINHAS
    for i, (nome, largura, formato) in enumerate(colunas, start=2):
        L = ws.cell(row=2, column=i).column_letter
        letra[nome] = L
        ws.column_dimensions[L].width = largura
        c = ws.cell(row=2, column=i, value=nome)
        c.font = Font(name='Montserrat', size=11, bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor=AZUL)
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        c.border = borda
        for r in range(3, fim + 1):
            d = ws.cell(row=r, column=i)
            d.font = Font(name='Arial', size=10)
            d.alignment = Alignment(vertical='center', wrap_text=nome in quebra)
            d.border = borda
            d.fill = PatternFill('solid', fgColor='FFFFFF' if r % 2 else LISTRA)
            if formato:
                d.number_format = formato
    for r in range(3, fim + 1):
        ws.row_dimensions[r].height = 22.5
    ws.freeze_panes = 'C3'
    ult = ws.cell(row=2, column=ultima).column_letter
    ws.auto_filter.ref = f'B2:{ult}{fim}'

    for nome, opcoes in listas.items():
        dv = DataValidation(type='list', formula1='"' + ','.join(opcoes) + '"', allow_blank=True, showErrorMessage=False)
        ws.add_data_validation(dv)
        dv.add(f'{letra[nome]}3:{letra[nome]}{fim}')
    for nome, formula, fundo, fonte in cores:
        L = letra[nome]
        ws.conditional_formatting.add(
            f'{L}3:{L}{fim}',
            FormulaRule(formula=[formula.format(c=f'${L}3')], fill=PatternFill('solid', fgColor=fundo, bgColor=fundo),
                        font=Font(bold=True, color=fonte) if fonte else None),
        )
    if cinza_se:
        ws.conditional_formatting.add(f'B3:{ult}{fim}', FormulaRule(formula=[cinza_se], font=Font(color='878787')))

    rs = wb.create_sheet('Resumo')
    rs.sheet_view.showGridLines = False
    rs['A1'] = f'Resumo – {titulo}'
    rs['A1'].font = Font(name='Arial', size=16, bold=True, color=PETROLEO)
    rs['A2'] = '="Atualizado em "&TEXT(TODAY(),"dd/mm/yyyy")'
    rs['A2'].font = Font(name='Arial', size=10, color='666666')
    rs.column_dimensions['A'].width = 34
    for L in 'BCD':
        rs.column_dimensions[L].width = 18
    linha = 4
    for titulo_bloco, coluna_criterio, itens, somas, curinga in resumo:
        cab = [titulo_bloco, 'Quantidade'] + [s for s, _ in somas]
        for j, t in enumerate(cab, start=1):
            c = rs.cell(row=linha, column=j, value=t)
            c.font = Font(name='Arial', bold=True, color='FFFFFF')
            c.fill = PatternFill('solid', fgColor=MARINHO)
        crit = letra[coluna_criterio]
        for k, (rotulo, valor) in enumerate(itens, start=1):
            r = linha + k
            alvo = f'"*{valor}*"' if curinga else f'"{valor}"'
            rs.cell(row=r, column=1, value=rotulo)
            rs.cell(row=r, column=2, value=f'=COUNTIF({aba}!${crit}$3:${crit}${fim},{alvo})')
            for j, (_, col_soma) in enumerate(somas, start=3):
                s = letra[col_soma]
                cel = rs.cell(row=r, column=j, value=f'=SUMIF({aba}!${crit}$3:${crit}${fim},{alvo},{aba}!${s}$3:${s}${fim})')
                cel.number_format = colunas_formato(colunas, col_soma)
            for j in range(1, 3 + len(somas)):
                rs.cell(row=r, column=j).font = Font(name='Arial', size=10)
                rs.cell(row=r, column=j).fill = PatternFill('solid', fgColor='FFFFFF' if k % 2 else LISTRA)
                rs.cell(row=r, column=j).border = borda
        linha += len(itens) + 3

    destino = RAIZ / 'public' / 'modelos' / arquivo
    wb.save(destino)
    print('gerado', destino)


def colunas_formato(colunas, nome):
    return next(f for n, _, f in colunas if n == nome) or 'General'


MOEDA = '"R$" #,##0.00'

# Banco de Projetos ------------------------------------------------------------
ESFERAS = ['CASDvest', 'Casdinho', 'CASDvest e Casdinho']
STATUS = ['Ideia', 'Em elaboração', 'Pronto para inscrever', 'Aprovado', 'Encerrado']
gerar(
    'projetos.xlsx', 'Projetos', 'Banco de Projetos CASD',
    [('Título', 34, None), ('Esfera', 18, None), ('Status', 20, None), ('Escopo', 50, None), ('Quem pediu', 20, None),
     ('Público atendido', 14, '#,##0'), ('Orçamento', 16, MOEDA), ('Editais vinculados', 34, None),
     ('Link dos documentos', 30, None), ('Observações da equipe', 36, None)],
    {'Esfera': ESFERAS, 'Status': STATUS},
    [('Esfera', '{c}="CASDvest"', 'D6ECF4', None), ('Esfera', '{c}="Casdinho"', 'FDECCB', None),
     ('Esfera', '{c}="CASDvest e Casdinho"', 'D4EFEA', None), ('Status', '{c}="Pronto para inscrever"', 'CDEBD8', None),
     ('Status', '{c}="Aprovado"', '3FA66B', 'FFFFFF'), ('Status', '{c}="Em elaboração"', 'FFE499', None)],
    '$D3="Encerrado"',
    {'Escopo', 'Observações da equipe', 'Editais vinculados'},
    [('Esfera', 'Esfera', [(e, e) for e in ESFERAS], [('Orçamento', 'Orçamento'), ('Público atendido', 'Público atendido')], False),
     ('Status', 'Status', [(s, s) for s in STATUS], [('Orçamento', 'Orçamento'), ('Público atendido', 'Público atendido')], False)],
)

# Calendário de Eventos ----------------------------------------------------------
SITUACOES = ['Proposta (a validar)', 'Aprovado', 'Em preparação', 'Realizado', 'Cancelado']
FREQ = ['Data única ou período', 'Recorrente (várias edições)', 'Contínuo (acompanhamento)']
gerar(
    'eventos.xlsx', 'Eventos', 'Calendário de Eventos CASD',
    [('Evento', 32, None), ('Tipo', 10, None), ('Situação', 20, None), ('Quando (previsão)', 30, None),
     ('Início', 13, 'dd/mm/yyyy'), ('Fim', 13, 'dd/mm/yyyy'), ('Data confirmada', 16, None), ('Frequência', 24, None),
     ('Local', 22, None), ('Responsável', 18, None), ('Meta de arrecadação', 18, MOEDA), ('Arrecadado', 16, MOEDA),
     ('Cotas de patrocínio', 30, None), ('Descrição', 40, None), ('Link', 28, None), ('Observações da equipe', 36, None)],
    {'Situação': SITUACOES, 'Data confirmada': ['Sim', 'Não (especulada)'], 'Frequência': FREQ},
    [('Tipo', 'ISNUMBER(SEARCH("EC",{c}))', 'FDECCB', None), ('Tipo', 'ISNUMBER(SEARCH("EI",{c}))', 'D6ECF4', None),
     ('Tipo', 'ISNUMBER(SEARCH("EA",{c}))', 'D4EFEA', None), ('Situação', '{c}="Aprovado"', 'D6ECF4', None),
     ('Situação', '{c}="Realizado"', '3FA66B', 'FFFFFF'), ('Situação', '{c}="Em preparação"', 'FFE499', None),
     ('Data confirmada', '{c}="Não (especulada)"', 'F2E6FA', None)],
    '$D3="Cancelado"',
    {'Descrição', 'Observações da equipe', 'Cotas de patrocínio', 'Quando (previsão)'},
    [('Tipo de evento', 'Tipo', [('EC · Captação', 'EC'), ('EI · Institucional', 'EI'), ('EA · Aberto', 'EA')],
      [('Meta de arrecadação', 'Meta de arrecadação'), ('Arrecadado', 'Arrecadado')], True),
     ('Situação', 'Situação', [(s, s) for s in SITUACOES], [('Meta de arrecadação', 'Meta de arrecadação'), ('Arrecadado', 'Arrecadado')], False)],
)
