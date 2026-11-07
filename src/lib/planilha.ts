// Gera a planilha de cada setor no próprio navegador (nada passa por servidor).
// Se existir o modelo do CASD em /public/modelos/<setor>.xlsx, preenche o modelo
// casando as colunas pelo nome do cabeçalho; senão, gera uma planilha padrão.

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

export interface Exportacao<T> {
  setor: string;
  /** Nome que aparece no arquivo e na aba: "Editais", "Doadores"… */
  nome: string;
  colunas: Coluna<T>[];
  itens: T[];
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

function baixar(dados: ArrayBuffer, arquivo: string) {
  const blob = new Blob([dados], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Gera e baixa a planilha. Devolve se usou o modelo do CASD ou o padrão. */
export async function gerarPlanilha<T>(exp: Exportacao<T>): Promise<{ usouModelo: boolean; linhas: number }> {
  const ExcelJS = (await import('exceljs')).default;
  const livro = new ExcelJS.Workbook();
  const hoje = hojeLocal();

  let usouModelo = false;
  const resposta = await fetch(`/modelos/${exp.setor}.xlsx`, { cache: 'no-store' }).catch(() => null);
  if (resposta?.ok) {
    await livro.xlsx.load(await resposta.arrayBuffer());
    const aba = livro.worksheets[0];
    if (aba && preencherModelo(aba, exp)) usouModelo = true;
  }

  if (!usouModelo) {
    livro.worksheets.slice().forEach((w) => livro.removeWorksheet(w.id));
    montarPadrao(livro.addWorksheet(exp.nome.slice(0, 31)), exp, hoje);
  }

  livro.creator = 'Portal do Captador · CASD';
  livro.modified = new Date();
  baixar(await livro.xlsx.writeBuffer(), nomeDoArquivo(exp.nome, hoje));
  return { usouModelo, linhas: exp.itens.length };
}

type Aba = import('exceljs').Worksheet;

/** Procura o cabeçalho nas 20 primeiras linhas e escreve os dados logo abaixo. */
export function preencherModelo<T>(aba: Aba, exp: Exportacao<T>): boolean {
  let linhaCab = 0;
  let mapa: number[] = [];
  for (let r = 1; r <= Math.min(20, aba.rowCount || 20); r++) {
    const linha = aba.getRow(r);
    const textos: string[] = [];
    for (let c = 1; c <= Math.max(linha.cellCount, 1); c++) textos.push(String(linha.getCell(c).text ?? ''));
    const m = casarCabecalho(textos, exp.colunas);
    if (m.filter((i) => i >= 0).length >= Math.min(2, exp.colunas.length)) {
      linhaCab = r;
      mapa = m;
      break;
    }
  }
  if (!linhaCab) return false;

  // Guarda o estilo da primeira linha de dados do modelo e limpa os dados antigos.
  const estilos = mapa.map((_, c) => ({ ...aba.getRow(linhaCab + 1).getCell(c + 1).style }));
  if (aba.rowCount > linhaCab) aba.spliceRows(linhaCab + 1, aba.rowCount - linhaCab);

  exp.itens.forEach((item, n) => {
    const r = linhaCab + 1 + n;
    const linha = aba.getRow(r);
    const colunaDe = (t: string) => {
      const i = exp.colunas.findIndex((c) => c.titulo === t);
      const c = mapa.indexOf(i);
      return i >= 0 && c >= 0 ? c + 1 : null;
    };
    mapa.forEach((i, c) => {
      if (i < 0) return;
      const col = exp.colunas[i];
      const celula = linha.getCell(c + 1);
      celula.style = { ...estilos[c] };
      celula.value = conteudo(col, item, r, colunaDe) as never;
      if (col.tipo && FORMATO[col.tipo] && !estilos[c].numFmt) celula.numFmt = FORMATO[col.tipo];
    });
    linha.commit();
  });
  return true;
}

export function montarPadrao<T>(aba: Aba, exp: Exportacao<T>, hoje: string) {
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
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: exp.colunas.length } };
  aba.headerFooter.oddFooter = `&CPortal do Captador - gerado em ${hoje.split('-').reverse().join('/')}`;
}
