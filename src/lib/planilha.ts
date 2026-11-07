// Gera a planilha de cada setor no próprio navegador (nada passa por servidor).
// Com modelo do CASD (/public/modelos/<modelo>.xlsx) ou com o arquivo atual do
// Drive, preenche as abas do portal mexendo só nas linhas de dados
// (xlsxModelo.ts). Sem modelo, gera uma planilha padrão.

import type { AbaModelo } from './xlsxModelo';

export type Valor = string | number | boolean | null | undefined;

export interface Coluna<T> {
  titulo: string;
  /** Outros nomes que o cabeçalho do modelo pode usar para esta coluna. */
  outrosNomes?: string[];
  tipo?: 'texto' | 'data' | 'moeda' | 'numero';
  largura?: number;
  valor: (item: T) => Valor;
  /**
   * Fórmula opcional, para a planilha continuar certa depois de ir para o Drive
   * (ex.: dias restantes recalculados todo dia). `ref("Prazo")` dá a célula da
   * coluna "Prazo" nesta linha, ou null se ela não existir na planilha.
   */
  formula?: (ref: (titulo: string) => string | null) => string | null;
}

export interface Exportacao {
  setor: string;
  /** Nome que aparece no arquivo: "Editais", "Doadores"… */
  nome: string;
  /** Arquivo em /public/modelos/ (sem .xlsx). Sem modelo, sai a planilha padrão. */
  modelo?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abas: AbaModelo<any>[];
}

/** "Valor / Orçamento (R$)" → "valororcamento". Serve para casar cabeçalhos. */
export function chaveDeCabecalho(t: string): string {
  return t
    .replace(/\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Para cada célula do cabeçalho do modelo, qual coluna nossa vai nela (ou -1).
 * Casa pelo título, pelos outros nomes, e aceita "(R$)", "*" e afins no modelo.
 */
export function casarCabecalho<T>(cabecalho: string[], colunas: Coluna<T>[]): number[] {
  const nomes = colunas.map((c) => [c.titulo, ...(c.outrosNomes ?? [])].map(chaveDeCabecalho));
  const usadas = new Set<number>();
  return cabecalho.map((celula) => {
    const k = chaveDeCabecalho(celula ?? '');
    if (!k) return -1;
    let i = nomes.findIndex((ns, j) => !usadas.has(j) && ns.includes(k));
    if (i < 0) i = nomes.findIndex((ns, j) => !usadas.has(j) && k.length >= 4 && ns.some((n) => n.length >= 4 && (k.startsWith(n) || n.startsWith(k))));
    if (i >= 0) usadas.add(i);
    return i;
  });
}

function paraCelula(v: Valor, tipo: Coluna<unknown>['tipo']): string | number | boolean | Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (tipo === 'data' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [a, m, d] = v.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d));
  }
  return v;
}

function letra(n: number): string {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Valor da célula; usa a fórmula quando der para montá-la. */
function conteudo<T>(col: Coluna<T>, item: T, linha: number, colunaDe: (titulo: string) => number | null) {
  const v = paraCelula(col.valor(item), col.tipo);
  if (!col.formula) return v;
  const f = col.formula((t) => {
    const c = colunaDe(t);
    return c ? `${letra(c)}${linha}` : null;
  });
  return f ? { formula: f, result: v ?? undefined } : v;
}

const FORMATO: Record<string, string> = { data: 'dd/mm/yyyy', moeda: '"R$" #,##0.00', numero: '#,##0' };

function nomeDoArquivo(nome: string, hoje: string) {
  return `CASD - Captação - ${nome} - ${hoje}.xlsx`;
}

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function baixar(dados: ArrayBuffer | Uint8Array, arquivo: string) {
  const blob = new Blob([dados as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface ResultadoPlanilha {
  usouModelo: boolean;
  arquivoAtual: boolean;
  linhas: number;
  abas: string[];
}

/**
 * Gera e baixa a planilha. Com `atual` (o arquivo baixado do Drive), devolve o
 * mesmo arquivo com as abas do portal atualizadas e as demais intactas.
 */
export async function gerarPlanilha(exp: Exportacao, atual?: ArrayBuffer): Promise<ResultadoPlanilha> {
  const hoje = hojeLocal();
  const linhas = exp.abas.reduce((s, a) => s + a.itens.length, 0);

  let base: ArrayBuffer | null = atual ?? null;
  if (!base && exp.modelo) {
    const r = await fetch(`/modelos/${exp.modelo}.xlsx`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) base = await r.arrayBuffer();
  }

  if (base) {
    const { preencherXlsx } = await import('./xlsxModelo');
    const r = await preencherXlsx(base, exp.abas);
    if (r.preenchidas.length === 0) {
      throw new Error(`o arquivo não tem a(s) aba(s) ${exp.abas.map((a) => `"${a.aba}"`).join(', ')} com o cabeçalho esperado`);
    }
    if (atual && r.faltando.length) throw new Error(`o arquivo não tem a(s) aba(s) ${r.faltando.map((a) => `"${a}"`).join(', ')}`);
    baixar(r.bytes, nomeDoArquivo(exp.nome, hoje));
    return { usouModelo: true, arquivoAtual: !!atual, linhas, abas: r.preenchidas };
  }

  const ExcelJS = (await import('exceljs')).default;
  const livro = new ExcelJS.Workbook();
  for (const aba of exp.abas) montarPadrao(livro.addWorksheet(aba.aba.slice(0, 31)), aba, hoje);
  livro.creator = 'Portal do Captador · CASD';
  livro.modified = new Date();
  baixar(await livro.xlsx.writeBuffer(), nomeDoArquivo(exp.nome, hoje));
  return { usouModelo: false, arquivoAtual: false, linhas, abas: exp.abas.map((a) => a.aba) };
}

type Aba = import('exceljs').Worksheet;

/** Planilha padrão (quando o setor não tem modelo do CASD). */
export function montarPadrao<T>(aba: Aba, exp: { colunas: Coluna<T>[]; itens: T[] }, hoje: string) {
  aba.columns = exp.colunas.map((c) => ({ header: c.titulo, width: c.largura ?? Math.max(14, c.titulo.length + 4) }));
  const cab = aba.getRow(1);
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12303D' } };
  cab.alignment = { vertical: 'middle', wrapText: true };
  cab.height = 30;
  const colunaDe = (t: string) => {
    const i = exp.colunas.findIndex((c) => c.titulo === t);
    return i >= 0 ? i + 1 : null;
  };
  exp.itens.forEach((item, n) => {
    aba.addRow(exp.colunas.map((c) => conteudo(c, item, n + 2, colunaDe)));
  });
  exp.colunas.forEach((c, i) => {
    if (c.tipo && FORMATO[c.tipo]) aba.getColumn(i + 1).numFmt = FORMATO[c.tipo];
    if (!c.tipo || c.tipo === 'texto') aba.getColumn(i + 1).alignment = { vertical: 'top', wrapText: true };
  });
  aba.views = [{ state: 'frozen', ySplit: 1 }];
  if (exp.colunas.length) aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: exp.colunas.length } };
  aba.headerFooter.oddFooter = `&CPortal do Captador - gerado em ${hoje.split('-').reverse().join('/')}`;
}
