// Funil de parcerias, com empresas inventadas.
import { describe, expect, it } from 'vitest';
import { contarFunil, etapaDoFunil, montarFileirasParcerias, Parceria } from './parceiros';

const pj = (organizacao: string, x: Partial<Parceria> = {}): Parceria => ({
  id: organizacao, organizacao, pessoa: null, cargo: null, email: null, telefone: null, rede_social: null, contexto: null, canal: null,
  mensagem: null, tipo: null, responsavel: null, contato_1: null, contato_2: null, contato_3: null, contato_4: null, ultimo_retorno: null,
  proxima_acao: null, status: 'a_abordar', interesse: null, observacoes: null, ...x,
});

describe('funil de parcerias', () => {
  it('a etapa depende da abordagem e da classificação do membro', () => {
    expect(etapaDoFunil(pj('A'))).toBe('topo');
    expect(etapaDoFunil(pj('B', { status: 'aguardando_retorno', interesse: 'frio' }))).toBe('topo');
    expect(etapaDoFunil(pj('C', { status: 'contato_iniciado', interesse: 'morno' }))).toBe('meio');
    expect(etapaDoFunil(pj('D', { status: 'reuniao_marcada' }))).toBe('meio');
    expect(etapaDoFunil(pj('E', { status: 'proposta_enviada' }))).toBe('fundo');
    expect(etapaDoFunil(pj('F', { status: 'apoio_confirmado' }))).toBe('pos');
    expect(etapaDoFunil(pj('G', { status: 'apoio_recusado', interesse: 'quente' }))).toBe('fora');
    expect(etapaDoFunil(pj('H', { status: 'alimentar_futuro', interesse: 'quente' }))).toBe('topo');
  });

  it('conta por etapa e ordena quem tem mais interesse primeiro', () => {
    const lista = [
      pj('Zeta', { status: 'contato_iniciado', interesse: 'frio', contato_1: '2026-10-30' }),
      pj('Alfa', { status: 'contato_iniciado', contato_1: '2026-11-07' }),
      pj('Beta', { status: 'contato_iniciado', interesse: 'quente', contato_1: '2026-11-07' }),
      pj('Gama', { status: 'aguardando_retorno', interesse: 'morno', contato_1: '2026-11-07' }),
    ];
    expect(contarFunil(lista)).toEqual({ topo: 2, meio: 2, fundo: 0, pos: 0, fora: 0 });
    const f = montarFileirasParcerias(lista, '2026-11-08');
    expect(f.find((x) => x.chave === 'meio')!.itens.map((p) => p.organizacao)).toEqual(['Beta', 'Gama']);
    expect(f.find((x) => x.chave === 'topo')!.itens.map((p) => p.organizacao)).toEqual(['Alfa', 'Zeta']);
    expect(f.find((x) => x.chave === 'retomar')!.itens.map((p) => p.organizacao)).toEqual(['Zeta']);
  });
});
