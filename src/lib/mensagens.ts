// Versões das mensagens do plano: cada checkpoint tem as versões 1, 2 e 3, cada uma no
// masculino e no feminino. A versão sugerida acompanha quantas mensagens do plano o doador
// já recebeu, para a mesma pessoa não receber o mesmo texto duas vezes.

import type { ParteMensagem } from './carteira';

export type Versao = 1 | 2 | 3;
export type Tratamento = 'm' | 'f';
export const VERSOES: Versao[] = [1, 2, 3];
export const TRATAMENTOS: [Tratamento, string][] = [['m', 'Masculino'], ['f', 'Feminino']];

/** { "1": { "m": [...], "f": [...] }, "2": ..., "3": ... } */
export type Variacoes = Partial<Record<string, Partial<Record<Tratamento, ParteMensagem[]>>>>;

/** Uma versão está preenchida quando alguma parte, em algum tratamento, tem texto. */
export function versaoPreenchida(v: Variacoes | null | undefined, versao: Versao): boolean {
  const ver = v?.[String(versao)];
  return !!ver && Object.values(ver).some((partes) => partes?.some((p) => p.texto.trim()));
}

/** Partes da versão e do tratamento; se o feminino estiver vazio, usa o masculino (e vice-versa). */
export function partesDaVariacao(v: Variacoes | null | undefined, versao: Versao, tratamento: Tratamento): ParteMensagem[] | null {
  const ver = v?.[String(versao)];
  if (!ver) return null;
  const cheias = (p?: ParteMensagem[]) => (p?.some((x) => x.texto.trim()) ? p.filter((x) => x.texto.trim()) : null);
  return cheias(ver[tratamento]) ?? cheias(ver[tratamento === 'm' ? 'f' : 'm']);
}

/**
 * Versão para a próxima mensagem do plano: 1ª mensagem -> versão 1, 2ª -> 2, 3ª -> 3, e volta.
 * Se a versão da vez ainda estiver em branco, cai para a anterior preenchida (no fim, a 1).
 */
export function versaoSugerida(v: Variacoes | null | undefined, mensagensDoPlanoJaEnviadas: number): Versao {
  const daVez = ((mensagensDoPlanoJaEnviadas % 3) + 1) as Versao;
  for (let n = daVez; n >= 1; n--) if (versaoPreenchida(v, n as Versao)) return n as Versao;
  return 1;
}

/** Variações completas para o editor: versões 1 a 3, os dois tratamentos, com as partes da base. */
export function completarVariacoes(v: Variacoes | null | undefined, base: ParteMensagem[]): Record<string, Record<Tratamento, ParteMensagem[]>> {
  const vazio = () => base.map((p) => ({ rotulo: p.rotulo, texto: '' }));
  const r: Record<string, Record<Tratamento, ParteMensagem[]>> = {};
  for (const n of VERSOES) {
    const ver = v?.[String(n)];
    r[String(n)] = {
      m: ver?.m?.length ? ver.m.map((p) => ({ ...p })) : n === 1 ? base.map((p) => ({ ...p })) : vazio(),
      f: ver?.f?.length ? ver.f.map((p) => ({ ...p })) : n === 1 ? base.map((p) => ({ ...p })) : vazio(),
    };
  }
  return r;
}

/** Bom dia / Boa tarde / Boa noite pela hora local. */
export function saudacaoDaHora(hora: number): string {
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}
