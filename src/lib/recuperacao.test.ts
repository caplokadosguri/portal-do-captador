import { describe, expect, it } from 'vitest';
import { pagoDesde, recuperacaoAtual, resumoRecuperacao, voltouAPagar, type Recuperacao } from './recuperacao';

// Dados inventados.
const rec = (recuperado_em: string, extra: Partial<Recuperacao> = {}): Recuperacao => ({
  id: recuperado_em, doador_id: 'D1', recuperado_em, inadimplente_desde: '2026-09-05', valor_mensal: 50,
  observacao: null, marcado_por: 'a@b', criado_em: recuperado_em, ...extra,
});
const paga = (data: string, valor: number) => ({ pago_em: data, status: 'Pago', vencimento: data, valor, valor_pago: valor });

describe('recuperação de inadimplentes', () => {
  it('a marcação vale até uma nova inadimplência', () => {
    expect(recuperacaoAtual([rec('2026-11-20')], '2026-09-05')?.recuperado_em).toBe('2026-11-20');
    expect(recuperacaoAtual([rec('2026-11-20')], null)).not.toBeNull();
    expect(recuperacaoAtual([rec('2026-11-20')], '2026-12-05')).toBeNull();
    expect(recuperacaoAtual([], '2026-09-05')).toBeNull();
  });

  it('soma o que foi pago desde a inadimplência', () => {
    const cc = [paga('2026-08-05', 50), paga('2026-11-21', 100), { pago_em: null, status: 'Falha grave', vencimento: '2026-10-05', valor: 50, valor_pago: null }];
    expect(pagoDesde(cc, '2026-09-05')).toBe(100);
  });

  it('sugere confirmar quem voltou a ficar em dia depois de uma cobrança', () => {
    expect(voltouAPagar({ situacao: 'em_dia', recuperacoes: [], ultimaCobranca: '2026-11-10T12:00:00Z' }, '2026-11-25')).toBe(true);
    expect(voltouAPagar({ situacao: 'em_dia', recuperacoes: [rec('2026-11-20')], ultimaCobranca: '2026-11-10T12:00:00Z' }, '2026-11-25')).toBe(false);
    expect(voltouAPagar({ situacao: 'atraso_1', recuperacoes: [], ultimaCobranca: '2026-11-10T12:00:00Z' }, '2026-11-25')).toBe(false);
    expect(voltouAPagar({ situacao: 'em_dia', recuperacoes: [], ultimaCobranca: '2026-05-10T12:00:00Z' }, '2026-11-25')).toBe(false);
  });

  it('resume recuperados e o que está em atraso', () => {
    const r = resumoRecuperacao([
      { situacao: 'em_dia', recuperacoes: [rec('2026-11-20')], recuperado: rec('2026-11-20'), cobrancas: [paga('2026-11-21', 100)], principal: { valor: 50 } },
      { situacao: 'atraso_2', recuperacoes: [], recuperado: null, cobrancas: [], principal: { valor: 30 } },
      { situacao: 'atraso_1', recuperacoes: [rec('2026-11-22')], recuperado: rec('2026-11-22'), cobrancas: [], principal: { valor: 20 } },
    ]);
    // O de atraso_1 marcado agora já conta no "por mês", mas ainda espera o pagamento na importação.
    expect(r).toEqual({ doadores: 2, recebido: 100, porMes: 100, aguardandoPagamento: 1, desistiram: 0, emAtraso: 1, porMesEmAtraso: 30 });
  });

  it('quem pediu para parar sai do atraso e não conta como recuperado', () => {
    const d = rec('2026-11-24', { tipo: 'desistiu' });
    const r = resumoRecuperacao([{ situacao: 'atraso_1', recuperacoes: [d], recuperado: d, cobrancas: [], principal: { valor: 50 } }]);
    expect(r).toMatchObject({ doadores: 0, porMes: 0, desistiram: 1, emAtraso: 0 });
  });
});
