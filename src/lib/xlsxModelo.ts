// Preenche uma planilha-modelo do CASD mexendo direto no XML do .xlsx.
//
// Por que não usar uma biblioteca de planilhas: elas reescrevem o arquivo
// inteiro e perdem coisas dos modelos (formatação condicional, listas
// suspensas, tabelas, logo, fórmulas do Google). Aqui só mudam as linhas de
// dados das abas que o portal preenche; o resto do arquivo fica igual.

import JSZip from 'jszip';
import { casarCabecalho, type Coluna, type Valor } from './planilha';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_XML = 'http://www.w3.org/XML/1998/namespace';

export interface AbaModelo<T> {
  /** Nome da aba no modelo. */
  aba: string;
  colunas: Coluna<T>[];
  itens: T[];
  /** "substituir" troca as linhas de dados; "acrescentar" escreve depois da última. */
  modo?: 'substituir' | 'acrescentar';
  /** No modo substituir: linhas já existentes que devem ficar (vêm antes das novas). */
  manter?: (linha: Record<string, string>) => boolean;
  /** Título da coluna cujas células iguais e seguidas viram uma célula mesclada (ex.: "Mês"). */
  agrupar?: string;
  /** Ajusta o texto de uma célula fora dos dados (ex.: "última atualização: ..."). */
  ajustes?: { celula: string; texto: (atual: string) => string }[];
  /** Colunas que identificam a linha na planilha do Drive (padrão: a primeira). */
  chave?: string[];
  /** O mesmo ajuste, na forma que a ponte do Drive entende. */
  ajustesDrive?: { celula: string; depoisDe: string; texto: string }[];
}

export interface Resultado {
  bytes: Uint8Array;
  preenchidas: string[];
  faltando: string[];
}

// ---------------------------------------------------------------------------
// Referências de célula e fórmulas
// ---------------------------------------------------------------------------

export function letraParaNumero(l: string): number {
  let n = 0;
  for (const ch of l) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function numeroParaLetra(n: number): string {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function partirRef(ref: string): { col: number; linha: number } {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) throw new Error(`Referência inválida: ${ref}`);
  return { col: letraParaNumero(m[1]), linha: Number(m[2]) };
}

/** Desloca as referências relativas de uma fórmula (como o Excel faz ao copiar). */
export function deslocarFormula(formula: string, dLinha: number, dCol = 0): string {
  if (!dLinha && !dCol) return formula;
  // Não mexe em textos entre aspas nem em nomes de aba entre apóstrofos.
  return formula
    .split(/("(?:[^"]|"")*"|'(?:[^']|'')*')/)
    .map((parte, i) =>
      i % 2 === 1
        ? parte
        : parte.replace(/(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/g, (_t, dc, col, dl, lin) => {
            const c = dc ? col : numeroParaLetra(letraParaNumero(col) + dCol);
            const l = dl ? lin : String(Number(lin) + dLinha);
            return `${dc}${c}${dl}${l}`;
          }),
    )
    .join('');
}

/** Dias desde 30/12/1899 (data serial do Excel e do Google Planilhas). */
function serialDeData(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

// ---------------------------------------------------------------------------
// Utilidades de XML
// ---------------------------------------------------------------------------

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}
const DECLARACAO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
function serializar(doc: Document): string {
  return DECLARACAO + new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
}
function filhos(el: Element, nome: string): Element[] {
  return Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).localName === nome);
}
function todos(doc: Document | Element, nome: string): Element[] {
  return Array.from(doc.getElementsByTagNameNS(NS, nome));
}
function texto(el: Element | undefined): string {
  return el?.textContent ?? '';
}
function caminho(base: string, alvo: string): string {
  if (alvo.startsWith('/')) return alvo.slice(1);
  const partes = base.split('/').slice(0, -1);
  for (const p of alvo.split('/')) {
    if (p === '..') partes.pop();
    else if (p !== '.') partes.push(p);
  }
  return partes.join('/');
}
function relsDe(arquivo: string): string {
  const partes = arquivo.split('/');
  const nome = partes.pop();
  return [...partes, '_rels', `${nome}.rels`].join('/');
}

// ---------------------------------------------------------------------------
// O preenchimento
// ---------------------------------------------------------------------------

interface Contexto {
  zip: JSZip;
  compartilhadas: string[];
  estilos: Document | null;
  estiloData: Map<string, string>;
}

/** Os formatos de data embutidos do Excel e os personalizados com d/m/a. */
function ehEstiloData(ctx: Contexto, s: string | null): boolean {
  if (!ctx.estilos || s === null) return false;
  const xfs = filhos(todos(ctx.estilos, 'cellXfs')[0], 'xf');
  const xf = xfs[Number(s)];
  if (!xf) return false;
  const id = Number(xf.getAttribute('numFmtId') ?? 0);
  if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true;
  const fmt = todos(ctx.estilos, 'numFmt').find((n) => Number(n.getAttribute('numFmtId')) === id);
  const codigo = (fmt?.getAttribute('formatCode') ?? '').replace(/"[^"]*"|\[[^\]]*\]/g, '').toLowerCase();
  return /[dy]/.test(codigo);
}

/** Um estilo igual ao da célula, mas com formato de data (dd/mm/aaaa). */
function estiloComData(ctx: Contexto, s: string | null): string | null {
  if (!ctx.estilos) return s;
  if (ehEstiloData(ctx, s)) return s;
  const chave = s ?? '0';
  const pronto = ctx.estiloData.get(chave);
  if (pronto) return pronto;
  const cellXfs = todos(ctx.estilos, 'cellXfs')[0];
  const xfs = filhos(cellXfs, 'xf');
  const novo = (xfs[Number(chave)] ?? xfs[0]).cloneNode(true) as Element;
  novo.setAttribute('numFmtId', '14');
  novo.setAttribute('applyNumberFormat', '1');
  cellXfs.appendChild(novo);
  cellXfs.setAttribute('count', String(xfs.length + 1));
  const indice = String(xfs.length);
  ctx.estiloData.set(chave, indice);
  return indice;
}

function textoDaCelula(ctx: Contexto, c: Element): string {
  const t = c.getAttribute('t');
  if (t === 's') return ctx.compartilhadas[Number(texto(filhos(c, 'v')[0]))] ?? '';
  if (t === 'inlineStr') return filhos(c, 'is').map((is) => is.textContent ?? '').join('');
  return texto(filhos(c, 'v')[0]);
}

function temFormula(c: Element | undefined): boolean {
  return !!c && filhos(c, 'f').length > 0;
}

/** Troca fórmulas compartilhadas por fórmulas explícitas em cada célula. */
function descompartilhar(doc: Document) {
  const mestres = new Map<string, { formula: string; linha: number; col: number }>();
  const celulas = todos(doc, 'c');
  for (const c of celulas) {
    const f = filhos(c, 'f')[0];
    if (f?.getAttribute('t') === 'shared' && f.getAttribute('ref') && (f.textContent ?? '') !== '') {
      const { linha, col } = partirRef(c.getAttribute('r')!);
      mestres.set(f.getAttribute('si')!, { formula: f.textContent!, linha, col });
    }
  }
  for (const c of celulas) {
    const f = filhos(c, 'f')[0];
    if (f?.getAttribute('t') !== 'shared') continue;
    const m = mestres.get(f.getAttribute('si') ?? '');
    const { linha, col } = partirRef(c.getAttribute('r')!);
    if (m) f.textContent = deslocarFormula(m.formula, linha - m.linha, col - m.col);
    f.removeAttribute('t');
    f.removeAttribute('ref');
    f.removeAttribute('si');
  }
}

function limparValor(c: Element) {
  for (const n of [...filhos(c, 'v'), ...filhos(c, 'is'), ...filhos(c, 'f')]) c.removeChild(n);
  c.removeAttribute('t');
}

function escreverValor(ctx: Contexto, doc: Document, c: Element, v: Valor, tipo: Coluna<unknown>['tipo']) {
  limparValor(c);
  if (v === null || v === undefined || v === '') return;
  if (tipo === 'data' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const s = estiloComData(ctx, c.getAttribute('s'));
    if (s !== null) c.setAttribute('s', s);
    const el = doc.createElementNS(NS, 'v');
    el.textContent = String(serialDeData(v));
    c.appendChild(el);
    return;
  }
  if (typeof v === 'number') {
    const el = doc.createElementNS(NS, 'v');
    el.textContent = String(v);
    c.appendChild(el);
    return;
  }
  if (typeof v === 'boolean') {
    c.setAttribute('t', 'b');
    const el = doc.createElementNS(NS, 'v');
    el.textContent = v ? '1' : '0';
    c.appendChild(el);
    return;
  }
  c.setAttribute('t', 'inlineStr');
  const is = doc.createElementNS(NS, 'is');
  const t = doc.createElementNS(NS, 't');
  t.setAttributeNS(NS_XML, 'xml:space', 'preserve');
  t.textContent = String(v);
  is.appendChild(t);
  c.appendChild(is);
}

function escreverFormula(doc: Document, c: Element, formula: string) {
  limparValor(c);
  const f = doc.createElementNS(NS, 'f');
  f.textContent = formula;
  c.appendChild(f);
}

class Folha {
  linhas = new Map<number, Element>();
  constructor(public doc: Document, public dados: Element) {
    for (const r of filhos(dados, 'row')) this.linhas.set(Number(r.getAttribute('r')), r);
  }
  linha(n: number, modelo?: Element): Element {
    let r = this.linhas.get(n);
    if (r) return r;
    r = this.doc.createElementNS(NS, 'row');
    if (modelo) for (const a of Array.from(modelo.attributes)) if (a.name !== 'r' && a.name !== 'spans') r.setAttribute(a.name, a.value);
    r.setAttribute('r', String(n));
    const depois = [...this.linhas.keys()].filter((k) => k > n).sort((a, b) => a - b)[0];
    this.dados.insertBefore(r, depois ? this.linhas.get(depois)! : null);
    this.linhas.set(n, r);
    return r;
  }
  celula(linha: Element, col: number, estilo?: string | null): Element {
    const n = Number(linha.getAttribute('r'));
    const ref = `${numeroParaLetra(col)}${n}`;
    const cs = filhos(linha, 'c');
    const achada = cs.find((c) => c.getAttribute('r') === ref);
    if (achada) return achada;
    const c = this.doc.createElementNS(NS, 'c');
    c.setAttribute('r', ref);
    if (estilo) c.setAttribute('s', estilo);
    const depois = cs.find((x) => partirRef(x.getAttribute('r')!).col > col);
    linha.insertBefore(c, depois ?? null);
    linha.removeAttribute('spans');
    return c;
  }
  celulaSeExiste(n: number, col: number): Element | undefined {
    const ref = `${numeroParaLetra(col)}${n}`;
    const r = this.linhas.get(n);
    return r ? filhos(r, 'c').find((c) => c.getAttribute('r') === ref) : undefined;
  }
}

async function preencherAba<T>(ctx: Contexto, arquivo: string, aba: AbaModelo<T>): Promise<boolean> {
  const doc = parse(await ctx.zip.file(arquivo)!.async('string'));
  const dados = todos(doc, 'sheetData')[0];
  if (!dados) return false;
  descompartilhar(doc);
  const folha = new Folha(doc, dados);

  // 1. Cabeçalho: a primeira das 20 linhas que casa com as nossas colunas.
  let cab = 0;
  let mapa: number[] = [];
  let titulos: string[] = [];
  for (let n = 1; n <= 20; n++) {
    const r = folha.linhas.get(n);
    if (!r) continue;
    const textos: string[] = [];
    for (const c of filhos(r, 'c')) textos[partirRef(c.getAttribute('r')!).col - 1] = textoDaCelula(ctx, c).trim();
    const cheios = Array.from(textos, (t) => t ?? '');
    const m = casarCabecalho(cheios, aba.colunas);
    if (m.filter((i) => i >= 0).length >= Math.min(2, aba.colunas.length)) {
      cab = n;
      mapa = m;
      titulos = cheios;
      break;
    }
  }
  if (!cab) return false;
  // Colunas novas do portal (com "depoisDe") que o modelo não tem: entram no fim do cabeçalho.
  const linhaCab = folha.linhas.get(cab)!;
  aba.colunas.forEach((coluna, k) => {
    if (!coluna.depoisDe || mapa.includes(k)) return;
    const col = titulos.length + 1;
    const estilo = folha.celulaSeExiste(cab, col - 1)?.getAttribute('s') ?? null;
    escreverValor(ctx, doc, folha.celula(linhaCab, col, estilo), coluna.titulo, 'texto');
    titulos.push(coluna.titulo);
    mapa.push(k);
  });
  const ultimaCol = titulos.length;
  const colDe = (titulo: string) => {
    const i = aba.colunas.findIndex((c) => c.titulo === titulo);
    const pos = mapa.indexOf(i);
    return i >= 0 && pos >= 0 ? pos + 1 : null;
  };

  // 2. Células mescladas: valor da célula principal vale para o intervalo todo.
  const mescla = todos(doc, 'mergeCells')[0];
  const mesclas = mescla ? filhos(mescla, 'mergeCell') : [];
  const valorMesclado = new Map<string, string>();
  for (const m of mesclas) {
    const [a, b] = (m.getAttribute('ref') ?? '').split(':');
    if (!a || !b) continue;
    const ia = partirRef(a);
    const ib = partirRef(b);
    const c = folha.celulaSeExiste(ia.linha, ia.col);
    const v = c ? textoDaCelula(ctx, c) : '';
    for (let l = ia.linha; l <= ib.linha; l++) for (let k = ia.col; k <= ib.col; k++) valorMesclado.set(`${k}:${l}`, v);
  }
  const colAgrupar = aba.agrupar ? colDe(aba.agrupar) : null;

  // 3. Lê as linhas de dados que já existem (antes de mexer em qualquer coisa).
  const ultimaLinha = Math.max(cab, ...folha.linhas.keys());
  const prototipo = folha.linhas.get(cab + 1);
  const formulaModelo = new Map<number, string>();
  if (prototipo) {
    for (const c of filhos(prototipo, 'c')) {
      const f = filhos(c, 'f')[0];
      if (f && f.textContent) formulaModelo.set(partirRef(c.getAttribute('r')!).col, f.textContent);
    }
  }
  interface Existente { linha: number; valores: Record<string, string>; celulas: Map<number, Element> }
  const existentes: Existente[] = [];
  for (let n = cab + 1; n <= ultimaLinha; n++) {
    const r = folha.linhas.get(n);
    const celulas = new Map<number, Element>();
    const valores: Record<string, string> = {};
    let vazia = true;
    for (let col = 1; col <= ultimaCol; col++) {
      const c = r ? filhos(r, 'c').find((x) => partirRef(x.getAttribute('r')!).col === col) : undefined;
      if (c) celulas.set(col, c.cloneNode(true) as Element);
      const v = valorMesclado.get(`${col}:${n}`) ?? (c ? textoDaCelula(ctx, c) : '');
      if (titulos[col - 1]) valores[titulos[col - 1]] = v;
      if (c && !temFormula(c) && col !== colAgrupar && textoDaCelula(ctx, c).trim() !== '') vazia = false;
    }
    if (!vazia) existentes.push({ linha: n, valores, celulas });
  }
  const manter = aba.modo === 'acrescentar' ? existentes : existentes.filter((e) => aba.manter?.(e.valores));
  const total = manter.length + aba.itens.length;
  const fim = Math.max(ultimaLinha, cab + total);

  // 4. Reescreve as linhas de dados no lugar.
  for (let i = 0; cab + 1 + i <= fim; i++) {
    const n = cab + 1 + i;
    const linha = folha.linha(n, prototipo);
    for (let col = 1; col <= ultimaCol; col++) {
      const estiloProto = prototipo ? folha.celulaSeExiste(cab + 1, col)?.getAttribute('s') ?? null : null;
      const existente = folha.celulaSeExiste(n, col);
      if (i < manter.length) {
        const origem = manter[i];
        const fonte = origem.celulas.get(col);
        const c = folha.celula(linha, col, estiloProto);
        limparValor(c);
        if (fonte) {
          for (const filho of Array.from(fonte.childNodes)) c.appendChild(filho.cloneNode(true));
          const t = fonte.getAttribute('t');
          if (t) c.setAttribute('t', t);
          const f = filhos(c, 'f')[0];
          if (f?.textContent) f.textContent = deslocarFormula(f.textContent, n - origem.linha);
        }
        // Célula mesclada de agrupamento: o valor está na principal.
        if (col === colAgrupar && !fonte?.childNodes.length) escreverValor(ctx, doc, c, origem.valores[titulos[col - 1]], 'texto');
      } else if (i < total) {
        const item = aba.itens[i - manter.length];
        const c = folha.celula(linha, col, existente?.getAttribute('s') ?? estiloProto);
        const modelo = formulaModelo.get(col);
        const k = mapa[col - 1];
        if (modelo) {
          escreverFormula(doc, c, deslocarFormula(modelo, n - (cab + 1)));
        } else if (k !== undefined && k >= 0) {
          const coluna = aba.colunas[k];
          const f = coluna.formula?.((t) => {
            const cc = colDe(t);
            return cc ? `${numeroParaLetra(cc)}${n}` : null;
          });
          if (f) escreverFormula(doc, c, f);
          else escreverValor(ctx, doc, c, coluna.valor(item), coluna.tipo);
        } else {
          limparValor(c);
        }
      } else if (existente && !temFormula(existente)) {
        limparValor(existente);
      } else if (!existente && formulaModelo.has(col) && n <= ultimaLinha) {
        // linha em branco do modelo sem a célula: nada a fazer
      }
    }
  }

  // 5. Mesclagens: tira as da área de dados e refaz a do agrupamento.
  if (mescla) {
    for (const m of mesclas) {
      const [a] = (m.getAttribute('ref') ?? '').split(':');
      if (a && partirRef(a).linha > cab) mescla.removeChild(m);
    }
  }
  if (colAgrupar && total > 1) {
    let inicio = cab + 1;
    const valorDe = (n: number) => {
      const c = folha.celulaSeExiste(n, colAgrupar);
      return c ? textoDaCelula(ctx, c) : '';
    };
    for (let n = cab + 2; n <= cab + total + 1; n++) {
      if (n > cab + total || valorDe(n) !== valorDe(inicio)) {
        if (n - 1 > inicio && valorDe(inicio)) {
          const alvo = mescla ?? (() => {
            const novo = doc.createElementNS(NS, 'mergeCells');
            dados.parentNode!.insertBefore(novo, dados.nextSibling);
            return novo;
          })();
          const m = doc.createElementNS(NS, 'mergeCell');
          const l = numeroParaLetra(colAgrupar);
          m.setAttribute('ref', `${l}${inicio}:${l}${n - 1}`);
          alvo.appendChild(m);
          for (let k = inicio + 1; k < n; k++) limparValor(folha.celulaSeExiste(k, colAgrupar)!);
        }
        inicio = n;
      }
    }
  }
  if (mescla) mescla.setAttribute('count', String(filhos(mescla, 'mergeCell').length));

  // 6. Validações e formatação condicional: estende até a última linha usada.
  const ultimaUsada = cab + total;
  const estender = (sqref: string) =>
    sqref
      .split(/\s+/)
      .map((faixa) => {
        const [a, b] = faixa.split(':');
        if (!b) return faixa;
        const ia = partirRef(a);
        const ib = partirRef(b);
        if (ia.linha <= cab + 1 && ib.linha > cab && ib.linha < ultimaUsada) return `${a}:${b.replace(/\d+$/, String(ultimaUsada))}`;
        return faixa;
      })
      .join(' ');
  for (const el of [...todos(doc, 'dataValidation'), ...todos(doc, 'conditionalFormatting')]) {
    const s = el.getAttribute('sqref');
    if (s) el.setAttribute('sqref', estender(s));
  }

  // 7. Tabelas da aba.
  const rels = ctx.zip.file(relsDe(arquivo));
  if (rels) {
    const rdoc = parse(await rels.async('string'));
    for (const rel of Array.from(rdoc.getElementsByTagName('Relationship'))) {
      if (!(rel.getAttribute('Type') ?? '').endsWith('/table')) continue;
      const caminhoTabela = caminho(arquivo, rel.getAttribute('Target')!);
      const tdoc = parse(await ctx.zip.file(caminhoTabela)!.async('string'));
      const tabela = tdoc.documentElement;
      const ref = tabela.getAttribute('ref') ?? '';
      const [a, b] = ref.split(':');
      if (!a || !b || partirRef(b).linha >= ultimaUsada || partirRef(a).linha > cab + 1) continue;
      const novo = `${a}:${b.replace(/\d+$/, String(ultimaUsada))}`;
      tabela.setAttribute('ref', novo);
      for (const af of todos(tdoc, 'autoFilter')) af.setAttribute('ref', novo);
      ctx.zip.file(caminhoTabela, serializar(tdoc));
    }
  }

  // 8. Ajustes de células fora dos dados e dimensão da aba.
  for (const aj of aba.ajustes ?? []) {
    const { col, linha } = partirRef(aj.celula);
    const r = folha.linha(linha);
    const c = folha.celula(r, col);
    const atual = textoDaCelula(ctx, c);
    escreverValor(ctx, doc, c, aj.texto(atual), 'texto');
  }
  const dim = todos(doc, 'dimension')[0];
  if (dim) {
    const ref = dim.getAttribute('ref') ?? 'A1';
    const fimRef = ref.split(':')[1] ?? ref;
    const { col } = partirRef(fimRef);
    dim.setAttribute('ref', `A1:${numeroParaLetra(Math.max(col, ultimaCol))}${Math.max(fim, partirRef(fimRef).linha)}`);
  }

  ctx.zip.file(arquivo, serializar(doc));
  return true;
}

/**
 * Apaga os textos compartilhados que nenhuma célula usa mais, para não sobrar
 * dado antigo dentro do arquivo. Mantém as posições (as outras abas não mudam).
 */
async function limparTextosSemUso(ctx: Contexto, abas: string[]) {
  const arq = ctx.zip.file('xl/sharedStrings.xml');
  if (!arq) return;
  const usados = new Set<number>();
  for (const a of abas) {
    const xml = await ctx.zip.file(a)!.async('string');
    for (const m of xml.matchAll(/<c\b[^>]*\bt="s"[^>]*>\s*<v>(\d+)<\/v>/g)) usados.add(Number(m[1]));
  }
  const sdoc = parse(await arq.async('string'));
  filhos(sdoc.documentElement, 'si').forEach((si, i) => {
    if (usados.has(i)) return;
    while (si.firstChild) si.removeChild(si.firstChild);
    si.appendChild(sdoc.createElementNS(NS, 't'));
  });
  ctx.zip.file('xl/sharedStrings.xml', serializar(sdoc));
}

/** Pede para Excel/Google recalcularem tudo ao abrir e descarta o cache de cálculo. */
async function recalcularAoAbrir(zip: JSZip) {
  const wb = parse(await zip.file('xl/workbook.xml')!.async('string'));
  let calc = todos(wb, 'calcPr')[0];
  if (!calc) {
    calc = wb.createElementNS(NS, 'calcPr');
    wb.documentElement.appendChild(calc);
  }
  calc.setAttribute('fullCalcOnLoad', '1');
  zip.file('xl/workbook.xml', serializar(wb));
  if (zip.file('xl/calcChain.xml')) {
    zip.remove('xl/calcChain.xml');
    const rels = parse(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'));
    for (const r of Array.from(rels.getElementsByTagName('Relationship'))) {
      if ((r.getAttribute('Target') ?? '').endsWith('calcChain.xml')) r.parentNode!.removeChild(r);
    }
    zip.file('xl/_rels/workbook.xml.rels', serializar(rels));
    const tipos = parse(await zip.file('[Content_Types].xml')!.async('string'));
    for (const o of Array.from(tipos.getElementsByTagName('Override'))) {
      if ((o.getAttribute('PartName') ?? '').endsWith('calcChain.xml')) o.parentNode!.removeChild(o);
    }
    zip.file('[Content_Types].xml', serializar(tipos));
  }
}

const chaveAba = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Lista as abas do arquivo (para conferir se é o modelo certo). */
export async function abasDoArquivo(arquivo: ArrayBuffer | Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(arquivo);
  const wb = parse(await zip.file('xl/workbook.xml')!.async('string'));
  return todos(wb, 'sheet').map((s) => s.getAttribute('name') ?? '');
}

/** Preenche as abas pedidas e devolve o arquivo novo. As outras abas ficam intactas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function preencherXlsx(arquivo: ArrayBuffer | Uint8Array, abas: AbaModelo<any>[]): Promise<Resultado> {
  const zip = await JSZip.loadAsync(arquivo);
  const wbArq = 'xl/workbook.xml';
  const wb = parse(await zip.file(wbArq)!.async('string'));
  const rels = parse(await zip.file(relsDe(wbArq))!.async('string'));
  const alvoDe = new Map<string, string>();
  for (const r of Array.from(rels.getElementsByTagName('Relationship'))) alvoDe.set(r.getAttribute('Id')!, caminho(wbArq, r.getAttribute('Target')!));
  const arquivoDaAba = new Map<string, string>();
  for (const s of todos(wb, 'sheet')) {
    const id = s.getAttributeNS(NS_REL, 'id') ?? s.getAttribute('r:id');
    const alvo = id ? alvoDe.get(id) : undefined;
    if (alvo) arquivoDaAba.set(chaveAba(s.getAttribute('name') ?? ''), alvo);
  }

  const ctx: Contexto = { zip, compartilhadas: [], estilos: null, estiloData: new Map() };
  const sst = zip.file('xl/sharedStrings.xml');
  if (sst) {
    const sdoc = parse(await sst.async('string'));
    ctx.compartilhadas = filhos(sdoc.documentElement, 'si').map((si) => todos(si, 't').map((t) => t.textContent ?? '').join(''));
  }
  const est = zip.file('xl/styles.xml');
  if (est) ctx.estilos = parse(await est.async('string'));

  const preenchidas: string[] = [];
  const faltando: string[] = [];
  for (const aba of abas) {
    const arq = arquivoDaAba.get(chaveAba(aba.aba));
    if (arq && (await preencherAba(ctx, arq, aba))) preenchidas.push(aba.aba);
    else faltando.push(aba.aba);
  }
  if (ctx.estilos && ctx.estiloData.size) zip.file('xl/styles.xml', serializar(ctx.estilos));
  await limparTextosSemUso(ctx, [...arquivoDaAba.values()]);
  await recalcularAoAbrir(zip);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes, preenchidas, faltando };
}

/** Data serial (Excel/Google) → "aaaa-mm-dd". */
function isoDeSerial(n: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
}

/**
 * Lê as linhas de dados de uma aba (para importar a planilha atual do Drive).
 * Devolve um objeto por linha não vazia, com os valores pelo título das
 * nossas colunas. Datas viram "aaaa-mm-dd"; números ficam como número.
 */
export async function lerAba<T>(
  arquivo: ArrayBuffer | Uint8Array,
  nomeAba: string,
  colunas: Coluna<T>[],
): Promise<Record<string, string | number | null>[] | null> {
  const zip = await JSZip.loadAsync(arquivo);
  const wbArq = 'xl/workbook.xml';
  const wb = parse(await zip.file(wbArq)!.async('string'));
  const rels = parse(await zip.file(relsDe(wbArq))!.async('string'));
  const folhaXml = todos(wb, 'sheet').find((s) => chaveAba(s.getAttribute('name') ?? '') === chaveAba(nomeAba));
  if (!folhaXml) return null;
  const id = folhaXml.getAttributeNS(NS_REL, 'id') ?? folhaXml.getAttribute('r:id');
  const rel = Array.from(rels.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === id);
  if (!rel) return null;
  const ctx: Contexto = { zip, compartilhadas: [], estilos: null, estiloData: new Map() };
  const sst = zip.file('xl/sharedStrings.xml');
  if (sst) {
    const sdoc = parse(await sst.async('string'));
    ctx.compartilhadas = filhos(sdoc.documentElement, 'si').map((si) => todos(si, 't').map((t) => t.textContent ?? '').join(''));
  }
  const doc = parse(await zip.file(caminho(wbArq, rel.getAttribute('Target')!))!.async('string'));
  const linhas = todos(doc, 'row').map((r) => ({
    n: Number(r.getAttribute('r')),
    celulas: filhos(r, 'c').map((c) => ({ col: partirRef(c.getAttribute('r')!).col, c })),
  }));
  let mapa: number[] | null = null;
  let cab = 0;
  for (const l of linhas.filter((x) => x.n <= 20)) {
    const textos: string[] = [];
    for (const { col, c } of l.celulas) textos[col - 1] = textoDaCelula(ctx, c).trim();
    const m = casarCabecalho(Array.from(textos, (t) => t ?? ''), colunas);
    if (m.filter((i) => i >= 0).length >= Math.min(2, colunas.length)) {
      mapa = m;
      cab = l.n;
      break;
    }
  }
  if (!mapa) return null;
  const saida: Record<string, string | number | null>[] = [];
  for (const l of linhas.filter((x) => x.n > cab)) {
    const reg: Record<string, string | number | null> = {};
    let algo = false;
    for (const { col, c } of l.celulas) {
      const k = mapa[col - 1];
      if (k === undefined || k < 0 || temFormula(c)) continue;
      const coluna = colunas[k];
      const bruto = textoDaCelula(ctx, c).trim();
      if (!bruto) continue;
      const t = c.getAttribute('t');
      const numero = !t || t === 'n' ? Number(bruto) : NaN;
      if (coluna.tipo === 'data') {
        if (Number.isFinite(numero)) reg[coluna.titulo] = isoDeSerial(numero);
        else {
          const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(bruto);
          reg[coluna.titulo] = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
        }
      } else if ((coluna.tipo === 'moeda' || coluna.tipo === 'numero') && Number.isFinite(numero)) {
        reg[coluna.titulo] = numero;
      } else {
        reg[coluna.titulo] = bruto;
      }
      algo = true;
    }
    if (algo) saida.push(reg);
  }
  return saida;
}
