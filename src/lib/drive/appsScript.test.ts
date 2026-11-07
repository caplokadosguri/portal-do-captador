// Roda o código da ponte do Drive contra uma planilha de mentira (dados inventados).
import { describe, expect, it } from 'vitest';
import { deslocarFormula, letraParaNumero, numeroParaLetra } from '../xlsxModelo';
import { exportarEditais, exportarParcerias } from '../exportacoes';
import type { Edital } from '../editais';
import { codigoAppsScript } from './codigoAppsScript';
import { pedidoDeEscrita } from './cliente';

type Celula = { v: unknown; f: string };

class Aba {
  grade: Celula[][] = [];
  merges: string[] = [];
  constructor(public nome: string, public id: number) {}
  cel(r: number, c: number): Celula {
    while (this.grade.length < r) this.grade.push([]);
    const l = this.grade[r - 1];
    while (l.length < c) l.push({ v: '', f: '' });
    return l[c - 1];
  }
  getName() { return this.nome; }
  getSheetId() { return this.id; }
  getLastRow() {
    for (let r = this.grade.length; r > 0; r--) if (this.grade[r - 1].some((x) => x.v !== '' || x.f)) return r;
    return 0;
  }
  getLastColumn() {
    let m = 0;
    this.grade.forEach((l) => l.forEach((x, c) => { if (x.v !== '' || x.f) m = Math.max(m, c + 1); }));
    return m;
  }
  getMaxRows() { return Math.max(this.grade.length, 100); }
  getMaxColumns() { return Math.max(...this.grade.map((l) => l.length), 26); }
  insertColumnAfter(c: number) { this.grade.forEach((l) => { while (l.length < c) l.push({ v: '', f: '' }); l.splice(c, 0, { v: '', f: '' }); }); }
  insertColumnsAfter() {}
  insertRowsAfter() {}
  setFrozenRows() {}
  getRange(r: number | string, c?: number, nr = 1, nc = 1): Faixa {
    if (typeof r === 'string') {
      const m = /^([A-Z]+)(\d+)$/.exec(r)!;
      return new Faixa(this, Number(m[2]), letraParaNumero(m[1]), 1, 1);
    }
    return new Faixa(this, r, c!, nr, nc);
  }
}

class Faixa {
  constructor(public aba: Aba, public r: number, public c: number, public nr: number, public nc: number) {}
  mapa<T>(fn: (cel: Celula, i: number, j: number) => T): T[][] {
    return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => fn(this.aba.cel(this.r + i, this.c + j), i, j)));
  }
  getValues() { return this.mapa((x) => (x.f ? '' : x.v)); }
  getDisplayValues() { return this.mapa((x) => (x.v instanceof Date ? x.v.toISOString() : String(x.v ?? ''))); }
  getFormulas() { return this.mapa((x) => x.f); }
  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return this.getDisplayValues()[0][0]; }
  setValues(v: unknown[][]) { this.mapa((x, i, j) => { x.v = v[i][j]; x.f = ''; }); return this; }
  setValue(v: unknown) { return this.setValues([[v]]); }
  setFormulas(f: string[][]) { this.mapa((x, i, j) => { x.f = f[i][j]; x.v = ''; }); return this; }
  clearContent() { this.mapa((x) => { x.v = ''; x.f = ''; }); return this; }
  breakApart() { this.aba.merges = []; return this; }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  copyTo(dest: Faixa, tipo: string) {
    if (tipo !== 'PASTE_FORMULA') return;
    const f = this.aba.cel(this.r, this.c).f;
    dest.mapa((x, i) => { x.f = deslocarFormula(f.replace(/^=/, ''), dest.r + i - this.r).replace(/^/, '='); x.v = ''; });
  }
}

function planilhaFalsa(abas: Aba[]) {
  return {
    getSheetByName: (n: string) => abas.find((a) => a.nome === n) ?? null,
    insertSheet: (n: string) => { const a = new Aba(n, abas.length + 1); abas.push(a); return a; },
    getUrl: () => 'https://docs.google.com/spreadsheets/d/PLANILHA_TESTE_1234567890/edit',
    getName: () => 'Planilha de teste',
    getSpreadsheetTimeZone: () => 'America/Sao_Paulo',
  };
}

function ponte(ss: ReturnType<typeof planilhaFalsa>, papel = 'admin', config: Record<string, string> = { drive_planilha_editais: 'https://docs.google.com/spreadsheets/d/PLANILHA_TESTE_1234567890/edit', drive_planilha_abordagem: 'PLANILHA_TESTE_1234567890' }) {
  const props = new Map<string, string>();
  const globais = {
    SpreadsheetApp: { openById: () => ss, flush: () => undefined, CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT', PASTE_DATA_VALIDATION: 'PASTE_DATA_VALIDATION', PASTE_FORMULA: 'PASTE_FORMULA' } },
    UrlFetchApp: {
      fetch: (url: string) => {
        const corpo = url.includes('/auth/v1/user')
          ? { email: 'Membro@casd.test' }
          : url.includes('/membros')
            ? [{ papel, ativo: true }]
            : Object.entries(config).map(([chave, valor]) => ({ chave, valor }));
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(corpo) };
      },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => props.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t: string) => ({ setMimeType: () => JSON.parse(t) }) },
    Utilities: { formatDate: (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` },
  };
  const codigo = codigoAppsScript('https://exemplo.supabase.co', 'sb_publishable_teste');
  const fabrica = new Function(...Object.keys(globais), `${codigo}\nreturn { doPost: doPost, doGet: doGet };`);
  const { doPost } = fabrica(...Object.values(globais));
  return (pedido: object) => doPost({ postData: { contents: JSON.stringify({ token: 'tok', ...pedido }) } });
}

function abaEditais() {
  const a = new Aba('Controle de Editais', 1);
  a.cel(1, 1).v = 'Monitoramento de Editais CASD – 2027  |  última atualização: ';
  ['Nome do edital', 'Organizador', 'Situação', 'Aderência ao CASD', 'Prioridade', 'Abertura', 'Prazo', 'Dias restantes', 'Valor / orçamento',
    'Lei de incentivo / fonte do recurso', 'Abrangência', 'Link', 'Observação', 'Responsável', 'Fonte (Mais Impacto)', 'Incluído em', 'Ordem (automático)', 'Anotações da equipe']
    .forEach((t, i) => { a.cel(2, i + 1).v = t; });
  for (let r = 3; r <= 6; r++) {
    a.cel(r, 8).f = `=IF(ISNUMBER(G${r}),G${r}-TODAY(),"")`;
    a.cel(r, 17).f = `=C${r}&G${r}`;
  }
  // Uma linha que já estava na planilha, com anotação numa coluna só da planilha.
  a.cel(3, 1).v = 'Edital Teste B';
  a.cel(3, 18).v = 'ligar para a fundação';
  return a;
}

const base: Edital = {
  id: '', nome: '', organizador: null, situacao: 'aberto', aderencia: null, prioridade: null, abertura: null, prazo: null,
  valor: null, fonte_recurso: null, abrangencia: null, link: null, observacao: null, responsavel: null, fonte_divulgacao: null,
  motivo_descarte: null, criado_em: '2026-11-01T10:00:00Z', atualizado_em: '2026-11-05T10:00:00Z',
};

describe('ponte com o Drive (Apps Script)', () => {
  it('escreve os editais mantendo as fórmulas e as anotações da equipe', () => {
    const controle = abaEditais();
    const ss = planilhaFalsa([controle]);
    const editais: Edital[] = [
      { ...base, id: 'a', nome: 'Edital Teste A', situacao: 'escrevendo', prazo: '2026-12-01', valor: 50000 },
      ...Array.from({ length: 6 }, (_, i): Edital => ({ ...base, id: `x${i}`, nome: `Edital Teste ${'BCDEFG'[i]}`, prazo: `2026-12-1${i}` })),
    ];
    const exp = exportarEditais(editais, [], [], '2026-11-06');
    const r = ponte(ss)({ acao: 'escrever', planilha: 'editais', abas: pedidoDeEscrita(exp) });
    expect(r.ok).toBe(true);
    expect(r.abas.map((a: { aba: string; linhas: number }) => [a.aba, a.linhas])).toEqual([['Controle de Editais', 7], ['Descartados', 0], ['Log semanal', 1]]);
    expect(controle.cel(3, 1).v).toBe('Edital Teste A');
    expect(controle.cel(3, 3).v).toBe('Escrevendo');
    expect((controle.cel(3, 7).v as Date).getDate()).toBe(1);
    expect(controle.cel(9, 8).f).toBe('=IF(ISNUMBER(G9),G9-TODAY(),"")'); // fórmula estendida
    expect(controle.cel(9, 17).f).toBe('=C9&G9');
    expect(controle.cel(4, 1).v).toBe('Edital Teste B');
    expect(controle.cel(4, 18).v).toBe('ligar para a fundação'); // anotação foi junto com o edital
    expect(controle.cel(3, 18).v).toBe('');
    expect(String(controle.cel(1, 1).v)).toContain('última atualização: 06/11/2026');

    // Log: duas sincronizações no mesmo dia ocupam uma linha só.
    ponte(ss)({ acao: 'escrever', planilha: 'editais', abas: pedidoDeEscrita(exp) });
    const log = ss.getSheetByName('Log semanal')!;
    expect(log.getLastRow()).toBe(2);
  });

  it('cria as colunas que faltam no lugar certo e lê de volta', () => {
    const pj = new Aba('Parcerias e Doações PJ', 2);
    ['', 'Organização', 'Nome da pessoa', 'Status da abordagem'].forEach((t, i) => { pj.cel(2, i + 1).v = t; });
    const ss = planilhaFalsa([pj]);
    const exp = exportarParcerias([{
      id: 'p', organizacao: 'Empresa Inventada', pessoa: 'Contato', cargo: null, email: null, telefone: null, rede_social: null, contexto: null,
      canal: null, mensagem: null, tipo: null, responsavel: null, contato_1: '2026-11-03', contato_2: null, contato_3: null, contato_4: null,
      ultimo_retorno: null, proxima_acao: null, status: 'reuniao_marcada', observacoes: null,
    }]);
    const chamar = ponte(ss, 'parceiros');
    expect(chamar({ acao: 'escrever', planilha: 'abordagem', abas: pedidoDeEscrita(exp) }).ok).toBe(true);
    expect(pj.cel(3, 2).v).toBe('Empresa Inventada');
    expect(pj.cel(2, 5).v).toBe('Cargo'); // colunas novas entram no fim
    const lido = chamar({ acao: 'ler', planilha: 'abordagem', abas: [{ aba: 'Parcerias e Doações PJ', colunas: pedidoDeEscrita(exp)[0].colunas }] });
    expect(lido.abas[0].linhas[0]).toMatchObject({ 'Organização': 'Empresa Inventada', 'Status da abordagem': 'Reunião marcada', 'Data do 1º contato': '2026-11-03' });
  });

  it('recusa quem não tem o perfil e planilha não ligada', () => {
    const ss = planilhaFalsa([abaEditais()]);
    expect(ponte(ss, 'doadores')({ acao: 'escrever', planilha: 'editais', abas: [] }).erro).toContain('perfil');
    expect(ponte(ss, 'admin', {})({ acao: 'ler', planilha: 'editais', abas: [] }).erro).toContain('ainda não foi ligada');
  });
});

// Garante que os auxiliares usados acima continuam exportados.
void numeroParaLetra;
