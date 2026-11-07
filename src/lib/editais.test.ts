// Testes com dados inventados.
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { diasRestantes, Edital, editalDestaque, montarFileirasEditais, textoDiasRestantes } from './editais';
import { COLUNAS_EDITAIS } from './exportacoes';
import { casarCabecalho, chaveDeCabecalho, montarPadrao, preencherModelo } from './planilha';

const base: Edital = {
  id: '', nome: '', organizador: null, situacao: 'novo', aderencia: null, prioridade: null, abertura: null, prazo: null,
  valor: null, fonte_recurso: null, abrangencia: null, link: null, observacao: null,
};
const ed = (x: Partial<Edital>): Edital => ({ ...base, ...x });
const HOJE = '2026-11-06';

const editais = [
  ed({ id: 'a', nome: 'Edital A', prazo: '2026-11-20', prioridade: 'media', abrangencia: 'municipal' }),
  ed({ id: 'b', nome: 'Edital B', prazo: '2026-12-30', prioridade: 'alta', situacao: 'em_escrita', abrangencia: 'nacional' }),
  ed({ id: 'c', nome: 'Edital C', prazo: '2026-10-01', prioridade: 'alta' }),
  ed({ id: 'd', nome: 'Edital D', situacao: 'em_analise' }),
  ed({ id: 'e', nome: 'Edital E', situacao: 'descartado' }),
];

describe('editais', () => {
  it('conta os dias restantes', () => {
    expect(diasRestantes('2026-11-20', HOJE)).toBe(14);
    expect(textoDiasRestantes(diasRestantes(HOJE, HOJE))).toBe('Termina hoje');
    expect(textoDiasRestantes(diasRestantes('2026-11-01', HOJE))).toBe('Prazo encerrado');
    expect(textoDiasRestantes(null)).toBe('Sem prazo');
  });

  it('destaca o mais urgente que ainda está no prazo (prioridade antes do prazo)', () => {
    expect(editalDestaque(editais, HOJE)?.id).toBe('b');
  });

  it('monta as fileiras e manda o prazo vencido para o arquivo', () => {
    const f = Object.fromEntries(montarFileirasEditais(editais, HOJE).map((x) => [x.chave, x.itens.map((e) => e.id)]));
    expect(f.prazo).toEqual(['a']);
    expect(f.prioridade).toEqual(['b']);
    expect(f.em_escrita).toEqual(['b']);
    expect(f.em_analise).toEqual(['d']);
    expect(f.municipal).toEqual(['a']);
    expect(f.arquivo.sort()).toEqual(['c', 'e']);
  });
});

describe('planilha', () => {
  it('casa cabeçalhos do modelo com nomes parecidos', () => {
    expect(chaveDeCabecalho('Valor / Orçamento (R$)')).toBe('valororcamento');
    const m = casarCabecalho(['Nº', 'Edital', 'Financiador', 'Status', 'Data limite', 'Valor (R$)', 'Coluna nossa'], COLUNAS_EDITAIS);
    const titulos = m.map((i) => (i >= 0 ? COLUNAS_EDITAIS[i].titulo : null));
    expect(titulos).toEqual([null, 'Nome do edital', 'Organizador', 'Situação', 'Prazo', 'Valor / orçamento', null]);
  });

  it('preenche o modelo abaixo do cabeçalho, com fórmula de dias restantes', async () => {
    const livro = new ExcelJS.Workbook();
    const aba = livro.addWorksheet('Editais');
    aba.getCell('A1').value = 'CASD · Gestão de editais';
    aba.getRow(3).values = ['Nome do edital', 'Prazo', 'Dias restantes', 'Situação'];
    aba.getRow(4).values = ['linha antiga', null, null, null];
    const ok = preencherModelo(aba, { setor: 'editais', nome: 'Editais', colunas: COLUNAS_EDITAIS, itens: editais.slice(0, 2) });
    expect(ok).toBe(true);
    expect(aba.getCell('A1').value).toBe('CASD · Gestão de editais');
    expect(aba.getCell('A4').value).toBe('Edital A');
    expect(aba.getCell('A5').value).toBe('Edital B');
    expect(aba.getCell('D5').value).toBe('Em escrita');
    expect((aba.getCell('B4').value as Date).toISOString().slice(0, 10)).toBe('2026-11-20');
    expect((aba.getCell('C4').value as { formula: string }).formula).toBe('IF(B4="","",B4-TODAY())');
    const buf = await livro.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it('gera a planilha padrão quando não há modelo', () => {
    const livro = new ExcelJS.Workbook();
    const aba = livro.addWorksheet('Editais');
    montarPadrao(aba, { setor: 'editais', nome: 'Editais', colunas: COLUNAS_EDITAIS, itens: editais }, HOJE);
    expect(aba.getCell('A1').value).toBe('Nome do edital');
    expect(aba.rowCount).toBe(1 + editais.length);
    expect((aba.getCell('H2').value as { formula: string }).formula).toBe('IF(G2="","",G2-TODAY())');
  });
});
