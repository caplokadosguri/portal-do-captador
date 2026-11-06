// Conversões dos formatos que a Trackmob exporta (datas e números no padrão brasileiro).

/** Minúsculas, sem acento, sem "(R$)" e com espaços simples. Usado para casar títulos de colunas. */
export function normalizarTitulo(titulo: string): string {
  return titulo
    .replace(/^﻿/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(r\$\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function vazio(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

export function texto(v: unknown): string | null {
  return vazio(v) ? null : String(v).trim();
}

/** Aceita "05/11/2026", "05/11/2026 14:32", "2026-11-05" e "2026-11-05T14:32:00". Devolve "AAAA-MM-DD". */
export function data(v: unknown): string | null {
  if (vazio(v)) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return montarData(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return montarData(+m[1], +m[2], +m[3]);
  return null;
}

function montarData(a: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Aceita "1.234,56", "50,00", "50.00", "R$ 50,00". */
export function numero(v: unknown): number | null {
  if (vazio(v)) return null;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/R\$|\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function inteiro(v: unknown): number | null {
  const n = numero(v);
  return n === null ? null : Math.round(n);
}

/** Aceita sim/não, true/false, 1/0, x. Vazio vira null (sem resposta). */
export function booleano(v: unknown): boolean | null {
  if (vazio(v)) return null;
  const s = normalizarTitulo(String(v));
  if (['sim', 's', 'true', 'verdadeiro', '1', 'x', 'yes'].includes(s)) return true;
  if (['nao', 'n', 'false', 'falso', '0', 'no'].includes(s)) return false;
  return null;
}

/** Diferença em meses inteiros entre duas datas "AAAA-MM-DD" (b - a). */
export function mesesEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  let meses = (yb - ya) * 12 + (mb - ma);
  if (db < da) meses -= 1;
  return meses;
}

export function somarMeses(dataIso: string, meses: number): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export function hojeIso(): string {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
