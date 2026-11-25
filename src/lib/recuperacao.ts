// Inadimplentes recuperados: o membro marca na ficha quando a abordagem terminou e o doador
// voltou a doar. A marcação tira o doador das fileiras de atraso (até uma nova inadimplência)
// e entra na conta do que a Captação recuperou.

import { cobrancaPaga, type Cobranca } from './situacao';
import { diasEntre } from './texto';

export interface Recuperacao {
  id: string;
  /** recuperado = voltou a doar; desistiu = pediu para parar de doar. */
  tipo?: 'recuperado' | 'desistiu' | null;
  doador_id: string;
  recuperado_em: string;
  inadimplente_desde: string | null;
  valor_mensal: number | null;
  observacao: string | null;
  marcado_por: string;
  criado_em: string;
}

/** Por quantos dias depois da última cobrança o portal sugere confirmar a recuperação. */
export const DIAS_PARA_CONFIRMAR = 120;

/**
 * A recuperação que vale para a situação atual: a mais recente, desde que a inadimplência em
 * aberto (se houver) tenha começado antes dela. Inadimplência nova depois da marcação = pendente de novo.
 */
export function recuperacaoAtual(recs: Recuperacao[], atrasoDesde: string | null): Recuperacao | null {
  const ultima = [...recs].sort((a, b) => b.recuperado_em.localeCompare(a.recuperado_em))[0];
  if (!ultima) return null;
  if (atrasoDesde && atrasoDesde > ultima.recuperado_em) return null;
  return ultima;
}

export const desistiu = (r: Recuperacao | null | undefined) => r?.tipo === 'desistiu';
const recuperados = (recs: Recuperacao[]) => recs.filter((r) => !desistiu(r));

/** Soma das cobranças pagas a partir de uma data (valor pago; na falta, o valor da cobrança). */
export function pagoDesde(cobrancas: Pick<Cobranca, 'pago_em' | 'status' | 'vencimento' | 'valor' | 'valor_pago'>[], desde: string): number {
  return cobrancas
    .filter((c) => cobrancaPaga(c) && (c.pago_em ?? c.vencimento ?? '') >= desde)
    .reduce((s, c) => s + Number(c.valor_pago ?? c.valor ?? 0), 0);
}

/** Pediu confirmação: recebeu cobrança nos últimos dias, voltou a ficar em dia e ainda não foi marcado. */
export function voltouAPagar(
  v: { situacao: string; recuperacoes: Recuperacao[]; ultimaCobranca: string | null },
  hoje: string,
): boolean {
  if (v.situacao !== 'em_dia' || !v.ultimaCobranca) return false;
  const dia = v.ultimaCobranca.slice(0, 10);
  if (diasEntre(dia, hoje) > DIAS_PARA_CONFIRMAR) return false;
  return !v.recuperacoes.some((r) => r.recuperado_em >= dia);
}

export interface ResumoRecuperacao {
  /** Doadores com pelo menos uma recuperação marcada. */
  doadores: number;
  /** Quanto eles já pagaram desde que ficaram inadimplentes. */
  recebido: number;
  /** Doações mensais que voltaram (recuperação valendo ou em dia; não conta cancelados). */
  porMes: number;
  /** Recuperados sem nenhum pagamento importado ainda (aparece na próxima importação da Trackmob). */
  aguardandoPagamento: number;
  /** Pediram para parar de doar (marcação valendo). */
  desistiram: number;
  /** Doadores em atraso agora (sem recuperação marcada). */
  emAtraso: number;
  /** Valor mensal desses doadores em atraso. */
  porMesEmAtraso: number;
}

export function resumoRecuperacao(
  visoes: {
    situacao: string;
    recuperacoes: Recuperacao[];
    recuperado: Recuperacao | null;
    cobrancas: Pick<Cobranca, 'pago_em' | 'status' | 'vencimento' | 'valor' | 'valor_pago'>[];
    principal: { valor: number | null } | null;
  }[],
): ResumoRecuperacao {
  const r: ResumoRecuperacao = { doadores: 0, recebido: 0, porMes: 0, aguardandoPagamento: 0, desistiram: 0, emAtraso: 0, porMesEmAtraso: 0 };
  for (const v of visoes) {
    if (desistiu(v.recuperado)) {
      r.desistiram++;
      continue;
    }
    const recs = recuperados(v.recuperacoes);
    if (recs.length) {
      r.doadores++;
      const desde = recs.map((x) => x.inadimplente_desde ?? x.recuperado_em).sort()[0];
      const pago = pagoDesde(v.cobrancas, desde);
      r.recebido += pago;
      if (!pago) r.aguardandoPagamento++;
      // Conta assim que é marcado (o pagamento só chega na próxima importação), enquanto a marcação valer.
      if (v.situacao !== 'cancelado' && (v.recuperado || v.situacao === 'em_dia')) {
        const ultima = [...recs].sort((a, b) => b.recuperado_em.localeCompare(a.recuperado_em))[0];
        r.porMes += Number(ultima.valor_mensal ?? v.principal?.valor ?? 0);
      }
    }
    if (v.situacao.startsWith('atraso') && !v.recuperado) {
      r.emAtraso++;
      r.porMesEmAtraso += Number(v.principal?.valor ?? 0);
    }
  }
  return r;
}
