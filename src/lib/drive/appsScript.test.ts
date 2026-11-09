// Roda o código da ponte do Drive contra uma planilha de mentira (dados inventados).
import { describe, expect, it } from 'vitest';
import { deslocarFormula, letraParaNumero, numeroParaLetra } from '../xlsxModelo';
import { exportarEditais, exportarEventos, exportarParcerias, exportarProjetos } from '../exportacoes';
import type { Evento } from '../eventos';
import type { GastoEvento } from '../eventosDetalhe';
import type { Edital } from '../editais';
import { codigoAppsScript, VERSAO_PONTE } from './codigoAppsScript';
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

function ponte(ss: ReturnType<typeof planilhaFalsa>, papel = 'admin', config: Record<string, string> = { drive_planilha_editais: 'https://docs.google.com/spreadsheets/d/PLANILHA_TESTE_1234567890/edit', drive_planilha_abordagem: 'PLANILHA_TESTE_1234567890', drive_planilha_projetos: 'PLANILHA_TESTE_1234567890' }, extras: Record<string, unknown> = {}) {
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
    DriveApp: {}, DocumentApp: {}, MimeType: { GOOGLE_DOCS: 'application/vnd.google-apps.document' },
    ...extras,
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
      ultimo_retorno: null, proxima_acao: null, status: 'reuniao_marcada', interesse: 'quente', observacoes: null,
    }]);
    const chamar = ponte(ss, 'parceiros');
    expect(chamar({ acao: 'escrever', planilha: 'abordagem', abas: pedidoDeEscrita(exp) }).ok).toBe(true);
    expect(pj.cel(3, 2).v).toBe('Empresa Inventada');
    // Colunas com lugar definido entram depois da coluna indicada; as outras, no fim.
    expect([pj.cel(2, 5).v, pj.cel(2, 6).v, pj.cel(2, 7).v]).toEqual(['Interesse', 'Etapa do funil', 'Cargo']);
    expect([pj.cel(3, 5).v, pj.cel(3, 6).v]).toEqual(['Quente (muito interesse)', 'Meio do funil']);
    const lido = chamar({ acao: 'ler', planilha: 'abordagem', abas: [{ aba: 'Parcerias e Doações PJ', colunas: pedidoDeEscrita(exp)[0].colunas }] });
    expect(lido.abas[0].linhas[0]).toMatchObject({ 'Organização': 'Empresa Inventada', 'Status da abordagem': 'Reunião marcada', 'Data do 1º contato': '2026-11-03' });
  });

  it('escreve projetos na aba do modelo novo, com a versão da ponte', () => {
    const aba = new Aba('Projetos', 3);
    aba.cel(1, 4).v = 'Banco de Projetos CASD  |  última atualização: ';
    ['', 'Título', 'Esfera', 'Status', 'Escopo', 'Quem pediu', 'Público atendido', 'Orçamento', 'Editais vinculados', 'Link dos documentos', 'Observações da equipe']
      .forEach((t, i) => { aba.cel(2, i + 1).v = t; });
    const ss = planilhaFalsa([aba]);
    const exp = exportarProjetos([{ id: 'p', titulo: 'Projeto Inventado', escopo: null, quem_pediu: null, esfera: 'Ambos', publico_atendido: 50, orcamento: 1000, status: 'pronto', link_documentos: null }], [], [], '2026-11-07');
    const r = ponte(ss, 'editais')({ acao: 'escrever', planilha: 'projetos', abas: pedidoDeEscrita(exp) });
    expect(r.ok).toBe(true);
    expect(r.versao).toBe(VERSAO_PONTE);
    expect(aba.cel(3, 2).v).toBe('Projeto Inventado');
    expect(aba.cel(3, 3).v).toBe('CASDvest e Casdinho');
    expect(aba.cel(3, 4).v).toBe('Pronto para inscrever');
    expect(String(aba.cel(1, 4).v)).toContain('última atualização: 07/11/2026');
    expect(ponte(ss, 'doadores')({ acao: 'ler', planilha: 'projetos', abas: [] }).erro).toContain('perfil');
  });

  it('planilha nova sem regra própria: admin e o perfil de mesmo nome', () => {
    const ss = planilhaFalsa([new Aba('Eventos', 4)]);
    const cfg = { drive_planilha_eventos: 'PLANILHA_TESTE_1234567890' };
    expect(ponte(ss, 'eventos', cfg)({ acao: 'ler', planilha: 'eventos', abas: [] }).ok).toBe(true);
    expect(ponte(ss, 'admin', cfg)({ acao: 'ler', planilha: 'eventos', abas: [] }).ok).toBe(true);
    expect(ponte(ss, 'editais', cfg)({ acao: 'ler', planilha: 'eventos', abas: [] }).erro).toContain('perfil');
    expect(ponte(ss, 'admin', cfg)({ acao: 'ler', planilha: '../x', abas: [] }).erro).toContain('desconhecida');
  });

  it('recusa quem não tem o perfil e planilha não ligada', () => {
    const ss = planilhaFalsa([abaEditais()]);
    expect(ponte(ss, 'doadores')({ acao: 'escrever', planilha: 'editais', abas: [] }).erro).toContain('perfil');
    expect(ponte(ss, 'admin', {})({ acao: 'ler', planilha: 'editais', abas: [] }).erro).toContain('ainda não foi ligada');
  });
});

describe('ponte com o Drive: subabas dos eventos', () => {
  it('anotação da equipe acompanha a linha pela chave Evento + Descrição', () => {
    const gastosAba = new Aba('Gastos', 2);
    ['Evento', 'Descrição', 'Categoria', 'Fornecedor', 'Previsto', 'Realizado', 'Situação', 'Data', 'Comprovante', 'Nota da equipe']
      .forEach((t, i) => { gastosAba.cel(2, i + 2).v = t; });
    // Já na planilha: dois eventos com um gasto de mesmo nome; a nota é do Bazar.
    gastosAba.cel(3, 2).v = 'Jogo Teste'; gastosAba.cel(3, 3).v = 'Lanche';
    gastosAba.cel(4, 2).v = 'Bazar Teste'; gastosAba.cel(4, 3).v = 'Lanche'; gastosAba.cel(4, 11).v = 'pedir nota fiscal';
    const ss = planilhaFalsa([new Aba('Eventos', 1), gastosAba]);
    const ev = (id: string, nome: string, inicio: string): Evento => ({
      id, nome, tipos: ['captacao'], situacao: 'aprovado', frequencia: 'unico', previsao: null, inicio, fim: inicio, data_confirmada: true,
      local: null, responsavel: null, meta: null, arrecadado: null, cotas: null, descricao: null, link: null,
    });
    const g = (id: string, evento_id: string): GastoEvento => ({
      id, evento_id, descricao: 'Lanche', categoria: null, fornecedor: null, previsto: 100, realizado: null, situacao: 'previsto', data: null, comprovante: null,
    });
    // Agora o Bazar vem primeiro no calendário: as linhas trocam de lugar.
    const exp = exportarEventos([ev('j', 'Jogo Teste', '2027-05-10'), ev('b', 'Bazar Teste', '2027-01-10')], '2026-11-07', {
      metas: [], patrocinadores: [], tarefas: [], gastos: [g('1', 'j'), g('2', 'b')],
    });
    const r = ponte(ss, 'eventos', { drive_planilha_eventos: 'PLANILHA_TESTE_1234567890' })({ acao: 'escrever', planilha: 'eventos', abas: pedidoDeEscrita(exp) });
    expect(r.ok).toBe(true);
    expect([gastosAba.cel(3, 2).v, gastosAba.cel(3, 3).v, gastosAba.cel(3, 11).v]).toEqual(['Bazar Teste', 'Lanche', 'pedir nota fiscal']);
    expect([gastosAba.cel(4, 2).v, gastosAba.cel(4, 11).v]).toEqual(['Jogo Teste', '']);
    // Abas que ainda não existiam na planilha antiga são criadas.
    expect(ss.getSheetByName('Tarefas')).not.toBeNull();
  });
});

// Documento de mentira: um texto com {{marcadores}}, com o findText do Google Docs.
function documentoFalso(texto: string) {
  const t = {
    s: texto,
    deleteText(a: number, b: number) { this.s = this.s.slice(0, a) + this.s.slice(b + 1); },
    insertText(a: number, v: string) { this.s = this.s.slice(0, a) + v + this.s.slice(a); },
  };
  const parte = {
    findText(padrao: string) {
      const m = new RegExp(padrao).exec(t.s);
      return m ? { getElement: () => ({ asText: () => t }), getStartOffset: () => m.index, getEndOffsetInclusive: () => m.index + m[0].length - 1 } : null;
    },
  };
  return { t, parte };
}

describe('ponte com o Drive: documentos', () => {
  const ID_DOC = 'DOCUMENTO_TESTE_1234567890';
  const config = {
    drive_planilha_projetos: 'PLANILHA_TESTE_1234567890',
    drive_doc_resumo_projeto: `https://docs.google.com/document/d/${ID_DOC}/edit`,
    drive_pasta_resumo_projeto: 'https://drive.google.com/drive/folders/PASTA_TESTE_1234567890',
  };
  function drive(mime = 'application/vnd.google-apps.document') {
    const { t, parte } = documentoFalso('Projeto {{titulo}} · {{ escopo }} · {{orcamento}} · {{titulo}}');
    const copias: { nome: string; pasta: string }[] = [];
    const extras = {
      DriveApp: {
        getFileById: (id: string) => ({
          getMimeType: () => mime,
          getName: () => 'Modelo resumo',
          getUrl: () => `https://docs.google.com/document/d/${id}/edit`,
          getParents: () => ({ hasNext: () => false }),
          makeCopy: (nome: string, pasta: { id: string }) => {
            copias.push({ nome, pasta: pasta.id });
            return { getId: () => 'COPIA', getUrl: () => 'https://docs.google.com/document/d/COPIA/edit', getName: () => nome };
          },
        }),
        getFolderById: (id: string) => ({ id }),
        getRootFolder: () => ({ id: 'raiz' }),
      },
      DocumentApp: { openById: () => ({ getBody: () => parte, getHeader: () => null, getFooter: () => null, saveAndClose: () => undefined }) },
    };
    return { t, copias, extras };
  }

  it('copia o modelo na pasta escolhida e troca todos os marcadores', () => {
    const { t, copias, extras } = drive();
    const r = ponte(planilhaFalsa([]), 'editais', config, extras)({
      acao: 'documento', planilha: 'projetos', abas: [],
      documento: { modelo: 'resumo_projeto', nome: 'Resumo – Projeto Teste', campos: { titulo: 'Projeto Teste', escopo: 'usa {{titulo}} no texto', orcamento: '' } },
    });
    expect(r.ok).toBe(true);
    expect(r.url).toContain('COPIA');
    expect(r.versao).toBe(VERSAO_PONTE);
    expect(copias).toEqual([{ nome: 'Resumo – Projeto Teste', pasta: 'PASTA_TESTE_1234567890' }]);
    // Vazio vira "—"; "{{" dentro de um valor não é trocado de novo.
    expect(t.s).toBe('Projeto Projeto Teste · usa { {titulo}} no texto · — · Projeto Teste');
  });

  it('teste de ligação não cria cópia; modelo ainda em Word dá erro claro', () => {
    const ok = drive();
    const r = ponte(planilhaFalsa([]), 'admin', config, ok.extras)({ acao: 'documento', planilha: 'projetos', abas: [], documento: { modelo: 'resumo_projeto', testar: true } });
    expect(r).toMatchObject({ ok: true, nome: 'Modelo resumo' });
    expect(ok.copias).toHaveLength(0);

    const word = drive('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const e = ponte(planilhaFalsa([]), 'admin', config, word.extras)({ acao: 'documento', planilha: 'projetos', abas: [], documento: { modelo: 'resumo_projeto', testar: true } });
    expect(e.ok).toBe(false);
    expect(e.erro).toMatch(/Salvar como Documentos Google/);
  });

  it('sem autorização do Drive: explica como autorizar', () => {
    const extras = { DriveApp: { getFileById: () => { throw new Error('Exception: You do not have permission to call DriveApp.getFileById. Required permissions: https://www.googleapis.com/auth/drive'); } } };
    const r = ponte(planilhaFalsa([]), 'admin', config, extras)({ acao: 'documento', planilha: 'projetos', abas: [], documento: { modelo: 'resumo_projeto', testar: true } });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/autorizarPonte/);
  });

  it('recusa quem não pode mexer em projetos e modelo não ligado', () => {
    const { extras } = drive();
    const pedido = { acao: 'documento', planilha: 'projetos', abas: [], documento: { modelo: 'resumo_projeto', nome: 'x', campos: {} } };
    expect(ponte(planilhaFalsa([]), 'doadores', config, extras)(pedido).ok).toBe(false);
    const semModelo = ponte(planilhaFalsa([]), 'admin', { drive_planilha_projetos: 'PLANILHA_TESTE_1234567890' }, extras)(pedido);
    expect(semModelo.erro).toMatch(/modelo do documento ainda não foi ligado/);
  });
});

// Garante que os auxiliares usados acima continuam exportados.
void numeroParaLetra;
