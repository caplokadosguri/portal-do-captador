import { describe, expect, it } from 'vitest';
import { inicioDaSemana, meusPlantoes, quandoRelativo, semanaParaEscalar, Plantao, rotuloDia, semMembro, textoDaEscala } from './escala';

const p = (id: string, data: string, membro_email: string | null, x: Partial<Plantao> = {}): Plantao => ({
  id, data, membro_email, periodo: null, diretor_do_dia: null, observacao: null, ...x,
});
const lista = [
  p('1', '2026-11-12', 'fulano@exemplo.org', { periodo: 'Tarde', diretor_do_dia: 'Diretor Teste' }),
  p('2', '2026-11-14', null),
  p('3', '2026-11-18', 'fulano@exemplo.org'),
  p('4', '2026-11-05', 'fulano@exemplo.org'), // já passou
  p('5', '2026-11-25', 'fulano@exemplo.org'), // daqui a duas semanas
  p('6', '2026-11-13', 'outra@exemplo.org'),
];

describe('escala da sede', () => {
  it('semana começa na segunda (domingo pertence à semana anterior)', () => {
    expect(inicioDaSemana('2026-11-08')).toBe('2026-11-02');
    expect(inicioDaSemana('2026-11-09')).toBe('2026-11-09');
    expect(inicioDaSemana('2026-11-12')).toBe('2026-11-09');
    expect(rotuloDia('2026-11-12')).toBe('quinta, 12/11');
    expect(semanaParaEscalar('2026-11-08')).toBe('2026-11-09'); // domingo: já abre a semana seguinte
    expect(semanaParaEscalar('2026-11-11')).toBe('2026-11-09');
    expect(quandoRelativo('2026-11-09', '2026-11-08')).toBe('amanhã');
  });

  it('membro vê os próprios dias desta semana e da que vem', () => {
    const meus = meusPlantoes(lista, 'Fulano@exemplo.org', '2026-11-10');
    expect(meus.map((x) => [x.data, x.quando])).toEqual([['2026-11-12', 'esta_semana'], ['2026-11-18', 'semana_que_vem']]);
  });

  it('conta dias sem membro e monta a mensagem da semana', () => {
    expect(semMembro(lista, '2026-11-09')).toBe(1);
    const t = textoDaEscala(lista, new Map([['fulano@exemplo.org', 'Fulano'], ['outra@exemplo.org', 'Outra']]), '2026-11-09');
    expect(t.split('\n')).toEqual([
      '*Captação na sede · semana de 09/11 a 15/11*',
      '• quinta, 12/11 (tarde): *Fulano* — diretor-de-dia: Diretor Teste',
      '• sexta, 13/11: *Outra*',
      '• sábado, 14/11: *a definir*',
    ]);
  });
});
