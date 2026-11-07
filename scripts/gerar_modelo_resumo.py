"""Gera o modelo do resumo de escopo de projeto, em public/modelos/resumo-projeto.docx.

O Rafael sobe este arquivo no Drive, abre com "Salvar como Documentos Google" e
cola o link em Início > Planilhas no Drive > Documentos. A ponte do portal copia
o documento e troca cada {{campo}} pelo que está na ficha do projeto.

Pode editar o modelo à vontade no Google Docs (texto, cores, ordem das seções),
desde que mantenha os {{campos}} escritos igual. Campos que o portal preenche:
titulo, esfera, status, quem_pediu, responsavel, publico_atendido, orcamento,
editais, link_documentos, objetivo, justificativa, escopo, publico_alvo,
atividades, cronograma, resultados_esperados, data, gerado_por.

Uso: python3 scripts/gerar_modelo_resumo.py
"""

from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

RAIZ = Path(__file__).resolve().parent.parent
AZUL, PETROLEO, CINZA = RGBColor(0x31, 0x92, 0xB3), RGBColor(0x1B, 0x59, 0x73), RGBColor(0x6B, 0x7F, 0x88)


def sombrear(celula, cor):
    tc = celula._tc.get_or_add_tcPr()
    sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear')
    sh.set(qn('w:color'), 'auto')
    sh.set(qn('w:fill'), cor)
    tc.append(sh)


def bordas(tabela, cor='3192B3'):
    tbl = tabela._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for lado in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{lado}')
        e.set(qn('w:val'), 'single')
        e.set(qn('w:sz'), '4')
        e.set(qn('w:color'), cor)
        b.append(e)
    tbl.append(b)


def larguras(tabela, *cms):
    tabela.autofit = False
    for col, cm in zip(tabela.columns, cms):
        col.width = Cm(cm)
        for c in col.cells:
            c.width = Cm(cm)


def texto(par, conteudo, *, tam=10, negrito=False, cor=None, fonte='Arial'):
    r = par.add_run(conteudo)
    r.font.name = fonte
    r.font.size = Pt(tam)
    r.bold = negrito
    if cor:
        r.font.color.rgb = cor
    return r


def main():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    for m in ('left_margin', 'right_margin'):
        setattr(sec, m, Cm(2.2))
    sec.top_margin, sec.bottom_margin = Cm(1.8), Cm(1.8)

    normal = doc.styles['Normal']
    normal.font.name = 'Arial'
    normal.font.size = Pt(10)

    # Rodapé
    rp = sec.footer.paragraphs[0]
    rp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    texto(rp, 'Gerado pelo Portal do Captador em {{data}} por {{gerado_por}} · CASD Captação', tam=8, cor=CINZA)

    # Cabeçalho: logo + título
    topo = doc.add_table(rows=1, cols=2)
    topo.alignment = WD_TABLE_ALIGNMENT.CENTER
    a, b = topo.rows[0].cells
    larguras(topo, 4.5, 12.1)
    a.paragraphs[0].add_run().add_picture(str(RAIZ / 'scripts' / 'casd-logo-planilha.png'), width=Cm(4))
    p = b.paragraphs[0]
    texto(p, 'Resumo de escopo de projeto', tam=16, negrito=True, cor=PETROLEO)
    p2 = b.add_paragraph()
    texto(p2, 'Para avaliação da assessoria de captação', tam=10, cor=CINZA)

    doc.add_paragraph()
    t = doc.add_paragraph()
    texto(t, '{{titulo}}', tam=14, negrito=True, cor=AZUL, fonte='Montserrat')

    # Ficha
    ficha = [
        ('Esfera', '{{esfera}}'),
        ('Status', '{{status}}'),
        ('Quem pediu', '{{quem_pediu}}'),
        ('Responsável', '{{responsavel}}'),
        ('Público atendido', '{{publico_atendido}}'),
        ('Orçamento estimado', '{{orcamento}}'),
        ('Editais em vista', '{{editais}}'),
        ('Documentos', '{{link_documentos}}'),
    ]
    tab = doc.add_table(rows=len(ficha), cols=2)
    bordas(tab)
    larguras(tab, 4.5, 12.1)
    for i, (rot, campo) in enumerate(ficha):
        c1, c2 = tab.rows[i].cells
        sombrear(c1, 'EAF4F8' if i % 2 == 0 else 'F6F8F9')
        if i % 2:
            sombrear(c2, 'F6F8F9')
        texto(c1.paragraphs[0], rot, negrito=True, cor=PETROLEO)
        texto(c2.paragraphs[0], campo)

    secoes = [
        ('Objetivo', '{{objetivo}}'),
        ('Justificativa', '{{justificativa}}'),
        ('Escopo', '{{escopo}}'),
        ('Público-alvo', '{{publico_alvo}}'),
        ('Atividades', '{{atividades}}'),
        ('Cronograma', '{{cronograma}}'),
        ('Resultados esperados e indicadores', '{{resultados_esperados}}'),
    ]
    for rot, campo in secoes:
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(14)
        h.paragraph_format.space_after = Pt(4)
        texto(h, rot, tam=12, negrito=True, cor=PETROLEO, fonte='Montserrat')
        corpo = doc.add_paragraph()
        corpo.paragraph_format.line_spacing = 1.15
        texto(corpo, campo)

    # Parecer, em branco para a assessoria
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(18)
    texto(h, 'Parecer da assessoria de captação', tam=12, negrito=True, cor=PETROLEO, fonte='Montserrat')
    par = doc.add_table(rows=4, cols=1)
    bordas(par)
    for i, rot in enumerate(['Viabilidade e aderência a editais:', 'Pontos a ajustar:', 'Recomendação (seguir / ajustar / não seguir):', 'Responsável e data:']):
        c = par.rows[i].cells[0]
        c.width = Cm(16.6)
        texto(c.paragraphs[0], rot, negrito=True, cor=CINZA)
        c.add_paragraph()

    destino = RAIZ / 'public' / 'modelos' / 'resumo-projeto.docx'
    doc.save(destino)
    print('gerado', destino.relative_to(RAIZ))


if __name__ == '__main__':
    main()
