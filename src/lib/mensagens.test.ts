import { describe, expect, it } from 'vitest';
import { completarVariacoes, partesDaVariacao, saudacaoDaHora, Variacoes, versaoSugerida } from './mensagens';

const v: Variacoes = {
  1: { m: [{ rotulo: 'A', texto: 'Olá, doador' }], f: [{ rotulo: 'A', texto: 'Olá, doadora' }] },
  2: { m: [{ rotulo: 'A', texto: 'Versão 2' }], f: [{ rotulo: 'A', texto: '' }] },
  3: { m: [{ rotulo: 'A', texto: '' }], f: [{ rotulo: 'A', texto: '' }] },
};

describe('versões das mensagens', () => {
  it('escolhe o tratamento e cai no outro se estiver vazio', () => {
    expect(partesDaVariacao(v, 1, 'f')![0].texto).toBe('Olá, doadora');
    expect(partesDaVariacao(v, 2, 'f')![0].texto).toBe('Versão 2');
    expect(partesDaVariacao(v, 3, 'm')).toBeNull();
  });

  it('versão sugerida pela quantidade de mensagens do plano, pulando versões vazias', () => {
    expect(versaoSugerida(v, 0)).toBe(1);
    expect(versaoSugerida(v, 1)).toBe(2);
    expect(versaoSugerida(v, 2)).toBe(2); // a 3 está em branco
    expect(versaoSugerida(v, 3)).toBe(1);
    expect(versaoSugerida(null, 1)).toBe(1);
  });

  it('completa as variações para o editor', () => {
    const c = completarVariacoes(null, [{ rotulo: 'A', texto: 'base' }]);
    expect(c['1'].f[0].texto).toBe('base');
    expect(c['3'].m).toEqual([{ rotulo: 'A', texto: '' }]);
  });

  it('saudação pela hora', () => {
    expect(saudacaoDaHora(9)).toBe('Bom dia');
    expect(saudacaoDaHora(14)).toBe('Boa tarde');
    expect(saudacaoDaHora(20)).toBe('Boa noite');
  });
});
