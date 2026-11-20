import { describe, expect, it } from 'vitest';
import { apelidoSugerido, compararNomes, cruzar, lerTurma, turmaCurta } from './wikita';

// Wikitexto inventado, no formato das páginas "Turma de AAAA".
const TEXTO = `
Turma que entrou em 2008.
== Formandos ==
* [[Fulano Teste da Silva]] ([[Turma de 2014]]) Profeta
* [[Beltrana Exemplo Souza|Beltrana E. Souza]] ([[AER]]) Bruninha
* [[Ciclano Modelo Ramos]] ([[COMP]]) Marte Ataca ou Alf
* [[Deltano Ficticio Lima]] ([[AESP]] 12' ) Zé Gota
* [[Evaldo Inventado Costa]] ([[MEC]])
* [[Turma de 2012]] (anterior)
* [https://exemplo.org Grupo da turma]
`;

describe('Wikita', () => {
  it('lê nome, detalhe e apelido de cada item da lista', () => {
    const p = lerTurma(TEXTO, 2013);
    expect(p).toHaveLength(5);
    expect(p[0]).toEqual({ nome: 'Fulano Teste da Silva', apelido: 'Profeta', detalhe: 'Turma de 2014', ano: 2013 });
    expect(p[1].nome).toBe('Beltrana E. Souza');
    expect(p[2].apelido).toBe('Marte Ataca ou Alf');
    expect(p[3]).toMatchObject({ detalhe: "AESP 12'", apelido: 'Zé Gota' });
    expect(p[4].apelido).toBe('');
  });

  it('apelido sugerido, turma curta', () => {
    expect(apelidoSugerido('Marte Ataca ou Alf')).toBe('Marte Ataca');
    expect(turmaCurta(2013)).toBe('T13');
    expect(turmaCurta(2005)).toBe('T05');
  });

  it('compara nomes sem acento e sem partículas', () => {
    expect(compararNomes('Fulano Teste da Silva', 'Fulano Teste Silva')).toBe('exato');
    expect(compararNomes('Fulano Silva', 'Fulano Teste da Silva')).toBe('provavel');
    expect(compararNomes('Fulano Souza', 'Fulano Teste da Silva')).toBeNull();
    expect(compararNomes('Fulano', 'Fulano Silva')).toBeNull();
    expect(compararNomes('Zé Gotas Ramos', 'Ze Gotas Ramos')).toBe('exato');
  });

  it('cruza doadores e pessoas, exatos primeiro', () => {
    const r = cruzar(
      [{ id: '1', nome: 'Fulano Silva' }, { id: '2', nome: 'Ciclano Modelo Ramos' }, { id: '3', nome: 'Outro Nome' }, { id: '4', nome: null }],
      lerTurma(TEXTO, 2013),
    );
    expect(r.map((c) => [c.doadorId, c.semelhanca])).toEqual([['2', 'exato'], ['1', 'provavel']]);
  });
});
