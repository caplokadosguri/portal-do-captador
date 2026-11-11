// Aniversário dos doadores: só dia e mês ficam guardados (o ano é descartado na importação).

const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

/** Próximo aniversário a partir de hoje (hoje conta). 29/02 cai em 28/02 nos anos comuns. */
export function proximoAniversario(dia: number | null, mes: number | null, hoje: string): string | null {
  if (!dia || !mes) return null;
  const ano = Number(hoje.slice(0, 4));
  for (const a of [ano, ano + 1]) {
    const d = mes === 2 && dia === 29 && !ehBissexto(a) ? 28 : dia;
    const iso = `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (iso >= hoje) return iso;
  }
  return null;
}

/** Dias até o próximo aniversário (0 = hoje), ou null sem data. */
export function diasAteAniversario(dia: number | null, mes: number | null, hoje: string): number | null {
  const prox = proximoAniversario(dia, mes, hoje);
  return prox ? Math.round((Date.parse(prox) - Date.parse(hoje)) / 86400000) : null;
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "hoje", "amanhã" ou "sex, 14/11". */
export function rotuloAniversario(dia: number, mes: number, hoje: string): string {
  const n = diasAteAniversario(dia, mes, hoje);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  const prox = proximoAniversario(dia, mes, hoje)!;
  return `${SEMANA[new Date(`${prox}T12:00:00Z`).getUTCDay()]}, ${prox.slice(8, 10)}/${prox.slice(5, 7)}`;
}
