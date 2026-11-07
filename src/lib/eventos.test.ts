// Eventos com dados inventados.
import { describe, expect, it } from 'vitest';
import { Evento, fileirasPorCalendario, fileirasPorTipo, mesesDaLinha, periodoCurto, posicaoNaLinha, proximoEvento, quando } from './eventos';
import { eventosDeLinhas } from './importarPlanilha';

const b: Omit<Evento, 'id' | 'nome' | 'tipos'> = {
  situacao: 'proposta', frequencia: 'unico', previsao: null, inicio: null, fim: null, data_confirmada: false, local: null,
  responsavel: null, meta: null, arrecadado: null, cotas: null, descricao: null, link: null,
};
const HOJE = '2026-11-07';
const ev: Evento[] = [
  { ...b, id: 'a', nome: 'Dia de Doar', tipos: ['captacao'], inicio: '2026-12-01', fim: '2026-12-01', data_confirmada: true },
  { ...b, id: 'b', nome: 'Jogo', tipos: ['captacao'], previsao: 'Meio de maio de 2027', inicio: '2027-05-10', fim: '2027-05-23' },
  { ...b, id: 'c', nome: 'Corrida', tipos: ['institucional', 'captacao'], inicio: '2027-07-01', fim: '2027-12-31' },
  { ...b, id: 'd', nome: 'Móvel', tipos: ['captacao'], frequencia: 'recorrente', previsao: 'Fins de semana' },
  { ...b, id: 'e', nome: 'Antigo', tipos: ['aberto'], inicio: '2026-03-01', fim: '2026-03-01' },
];

describe('eventos', () => {
  it('mostra quando: data confirmada, previsão ou recorrência', () => {
    expect(quando(ev[0])).toBe('1 dez de 2026');
    expect(quando(ev[1])).toBe('Meio de maio de 2027');
    expect(quando(ev[3])).toBe('Fins de semana');
  });
  it('rótulo curto do período para o card', () => {
    expect(periodoCurto(ev[0])).toBe('1 dez 2026');
    expect(periodoCurto(ev[1])).toBe('mai 2027');
    expect(periodoCurto({ ...ev[1], fim: '2027-06-10' })).toBe('mai–jun 2027');
    expect(periodoCurto(ev[2])).toBe('2º sem. 2027');
    expect(periodoCurto(ev[3])).toBe('Recorrente');
  });
  it('acha o próximo evento e monta o calendário por semestre', () => {
    expect(proximoEvento(ev, HOJE)?.id).toBe('a');
    const f = Object.fromEntries(fileirasPorCalendario(ev, HOJE).map((x) => [x.chave, x.itens.map((e) => e.id)]));
    expect(f.proximos).toEqual(['a']);
    expect(f['2º semestre de 2026']).toBeUndefined(); // já está em "próximos 90 dias"
    expect(f['1º semestre de 2027']).toEqual(['b']);
    expect(f['2º semestre de 2027']).toEqual(['c']);
    expect(f.ano).toEqual(['d']);
    expect(f.passados).toEqual(['e']);
  });
  it('por tipo: evento com dois tipos aparece nas duas fileiras', () => {
    const f = Object.fromEntries(fileirasPorTipo(ev, HOJE).map((x) => [x.chave, x.itens.map((e) => e.id)]));
    expect(f.captacao).toEqual(['a', 'b', 'c', 'd']);
    expect(f.institucional).toEqual(['c']);
  });
  it('linha do tempo cobre do mês atual ao último evento', () => {
    const m = mesesDaLinha(ev, HOJE);
    expect(m[0]).toBe('2026-11');
    expect(m[m.length - 1]).toBe('2027-12');
    expect(posicaoNaLinha('2026-11-01', m)).toBe(0);
    expect(posicaoNaLinha('2027-12-31', m, true)).toBe(1);
  });
  it('lê eventos da planilha', () => {
    const [e] = eventosDeLinhas([{ Evento: 'Corrida', Tipo: 'EI/EC', 'Situação': 'Aprovado', 'Início': '2027-07-01', 'Data confirmada': 'Não (especulada)', 'Frequência': 'Data única ou período' }]);
    expect(e).toMatchObject({ tipos: ['institucional', 'captacao'], situacao: 'aprovado', inicio: '2027-07-01', fim: '2027-07-01', data_confirmada: false });
  });
});
