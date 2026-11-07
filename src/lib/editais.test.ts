// Testes com dados inventados.
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { diasRestantes, Edital, editalDestaque, montarFileirasEditais, textoDiasRestantes } from './editais';
import { COLUNAS_EDITAIS } from './exportacoes';
import { casarCabecalho, chaveDeCabecalho, montarPadrao } from './planilha';

const base: Edital = {
  id: '', nome: '', organizador: null, situacao: 'aberto', aderencia: null, prioridade: null, abertura: null, prazo: null,
  valor: null, fonte_recurso: null, abrangencia: null, link: null, observacao: null, responsavel: null, fonte_divulgacao: null,
  motivo_descarte: null,
};
const ed = (x: Partial<Edital>): Edital => ({ ...base, ...x });
const HOJE = '2026-11-06';

const editais = [
  ed({ id: 'a', nome: 'Edital A', prazo: '2026-11-20', prioridade: 'media', abrangencia: 'municipal' }),
  ed({ id: 'b', nome: 'Edital B', prazo: '2026-12-30', prioridade: 'alta', situacao: 'escrevendo', abrangencia: 'nacional' }),
  ed({ id: 'c', nome: 'Edital C', prazo: '2026-10-01', prioridade: 'alta' }),
  ed({ id: 'd', nome: 'Edital D', situacao: 'inscrito' }),
  ed({ id: 'e', nome: 'Edital E', situacao: 'encerrado' }),
  ed({ id: 'f', nome: 'Edital F', situacao: 'descartado' }),
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
    expect(f.escrevendo).toEqual(['b']);
    expect(f.inscrito).toEqual(['d']);
    expect(f.descartado).toEqual(['f']);
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

  it('gera a planilha padrão quando não há modelo', () => {
    const livro = new ExcelJS.Workbook();
    const aba = livro.addWorksheet('Editais');
    montarPadrao(aba, { colunas: COLUNAS_EDITAIS, itens: editais }, HOJE);
    expect(aba.getCell('A1').value).toBe('Nome do edital');
    expect(aba.rowCount).toBe(1 + editais.length);
    expect((aba.getCell('H2').value as { formula: string }).formula).toContain('IF(ISNUMBER(G2),IF(OR(C2="Encerrado"');
  });
});
