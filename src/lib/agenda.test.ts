import { describe, expect, it } from 'vitest';
import { contatosDaFileira } from './agenda';
import type { VisaoDoador } from './carteira';

// Dados inventados.
const visao = (id: string, nome: string, celular: string | null, dias?: number) =>
  ({ doador: { id, nome, celular, email: null }, marco: dias === undefined ? null : { dias, data: '2026-11-17', checkpoint: { chave: 'meses_6', nome: '6 meses' } } }) as unknown as VisaoDoador;

describe('contatos da fileira', () => {
  it('checkpoints: só hoje e atrasados, com etiqueta e data', () => {
    const r = contatosDaFileira('checkpoints', [visao('1', 'Ana Teste', '12999990001', 0), visao('2', 'Beto Teste', '12999990002', -3), visao('3', 'Caio Teste', '12999990003', 4)], '2026-11-17')!;
    expect(r.quantidade).toBe(2);
    expect(r.rotuloBotao).toBe('Baixar checkpoints de hoje');
    expect(r.arquivo).toBe('Checkpoint 17-11.vcf');
    expect(r.conteudo).toContain('FN:Ana Teste - Checkpoint - 17/11');
    expect(r.conteudo).toContain('FN:Beto Teste - Checkpoint - 17/11');
    expect(r.conteudo).not.toContain('Caio');
  });

  it('inadimplentes: pula quem não tem celular válido e repete só uma vez', () => {
    const r = contatosDaFileira('atraso_1', [visao('1', 'Ana Teste', '12999990001'), visao('1', 'Ana Teste', '12999990001'), visao('2', 'Beto Teste', '123')], '2026-11-17')!;
    expect(r.quantidade).toBe(1);
    expect(r.conteudo).toContain('FN:Ana Teste - Inadimplente - 17/11');
    expect(r.conteudo).toContain('TEL;TYPE=CELL:+5512999990001');
  });

  it('sem ninguém com celular, sem botão', () => {
    expect(contatosDaFileira('aniversarios', [visao('1', 'Ana Teste', null)], '2026-11-17')).toBeNull();
  });

  it('atenção: etiqueta pela situação', () => {
    const v = { ...visao('1', 'Ana Teste', '12999990001'), situacao: 'atraso_2' } as VisaoDoador;
    const r = contatosDaFileira('atencao', [v], '2026-11-17')!;
    expect(r.conteudo).toContain('FN:Ana Teste - Inadimplente - 17/11');
  });
});
