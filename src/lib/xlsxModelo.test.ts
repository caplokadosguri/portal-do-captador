// Preenchimento dos modelos do CASD, com dados inventados.
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import fs from 'fs';
import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';
import type { VisaoDoador } from './carteira';
import type { Edital } from './editais';
import { exportarEditais, exportarInadimplentes, exportarParcerias } from './exportacoes';
import type { Parceria } from './parceiros';
import { deslocarFormula, preencherXlsx } from './xlsxModelo';

beforeAll(() => {
  Object.assign(globalThis, { DOMParser, XMLSerializer });
});

const modelo = (n: string) => fs.readFileSync(new URL(`../../public/modelos/${n}.xlsx`, import.meta.url));

async function aba(bytes: Uint8Array, nomeAba: string): Promise<{ xml: string; celula: (ref: string) => string }> {
  const zip = await JSZip.loadAsync(bytes);
  const wb = await zip.file('xl/workbook.xml')!.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const id = new RegExp(`name="${nomeAba}"[^>]*r:id="([^"]+)"`).exec(wb)![1];
  const alvo = new RegExp(`Id="${id}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${id}"`).exec(rels)!;
  const xml = await zip.file(`xl/${alvo[1] ?? alvo[2]}`)!.async('string');
  const celula = (ref: string) => {
    const m = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>(.*?)</c>)`).exec(xml);
    return m?.[1] ?? '';
  };
  return { xml, celula };
}

const base: Edital = {
  id: '', nome: '', organizador: null, situacao: 'aberto', aderencia: null, prioridade: null, abertura: null, prazo: null,
  valor: null, fonte_recurso: null, abrangencia: null, link: null, observacao: null, responsavel: null, fonte_divulgacao: null,
  motivo_descarte: null, criado_em: '2026-11-01T10:00:00Z', atualizado_em: '2026-11-05T10:00:00Z',
};

describe('fórmulas', () => {
  it('desloca referências relativas e respeita $ e textos', () => {
    expect(deslocarFormula('IF(ISNUMBER(G3),G3-TODAY(),"G3")', 2)).toBe('IF(ISNUMBER(G5),G5-TODAY(),"G3")');
    expect(deslocarFormula("COUNTIF('Controle de Editais'!$C$3:$C$299,A5)+B$1", 1)).toBe("COUNTIF('Controle de Editais'!$C$3:$C$299,A6)+B$1");
    expect(deslocarFormula('LOG10(A1)', 1)).toBe('LOG10(A2)');
  });
});

describe('modelo de editais', () => {
  it('preenche Controle, Descartados e Log mantendo as fórmulas do modelo', async () => {
    const editais: Edital[] = [
      { ...base, id: 'a', nome: 'Edital Teste A', organizador: 'Instituto Exemplo', situacao: 'escrevendo', aderencia: 'alta', prioridade: 'alta', prazo: '2026-12-01', valor: 50000 },
      { ...base, id: 'b', nome: 'Edital Teste B', situacao: 'inscrito', aderencia: 'a_revisar', prazo: '2026-11-20' },
      { ...base, id: 'c', nome: 'Edital Fora', situacao: 'descartado', motivo_descarte: 'Só para outro estado', prazo: '2026-10-30' },
    ];
    const exp = exportarEditais(editais, [], [], '2026-11-06');
    const r = await preencherXlsx(modelo('editais'), exp.abas);
    expect(r.preenchidas).toEqual(['Controle de Editais', 'Descartados', 'Log semanal']);

    const c = await aba(r.bytes, 'Controle de Editais');
    expect(c.celula('A3')).toContain('Edital Teste A'); // em andamento com prazo vem antes do inscrito
    expect(c.celula('C3')).toContain('Escrevendo');
    expect(c.celula('D4')).toContain('A revisar');
    expect(c.celula('G3')).toBe('<v>46357</v>'); // 01/12/2026 como data
    expect(c.celula('H3')).toContain('<f>IF(ISNUMBER(G3)');
    expect(c.celula('Q4')).toContain('<f>IF(OR(C4=');
    expect(c.celula('A1')).toContain('última atualização: 06/11/2026');
    expect(c.xml).not.toContain('Edital Fora');

    const d = await aba(r.bytes, 'Descartados');
    expect(d.celula('A3')).toContain('Edital Fora');
    expect(d.celula('C3')).toContain('Só para outro estado');

    const l = await aba(r.bytes, 'Log semanal');
    expect(l.celula('A3')).toBe('<v>46332</v>');
    expect(l.celula('F3')).toContain('Edital Teste A – 01/12/2026');

    // Gerar de novo sobre o arquivo gerado: substitui o controle e acrescenta no log.
    const r2 = await preencherXlsx(r.bytes, exp.abas);
    const l2 = await aba(r2.bytes, 'Log semanal');
    expect(l2.celula('A4')).toBe('<v>46332</v>');
    const c2 = await aba(r2.bytes, 'Controle de Editais');
    expect(c2.xml.match(/Edital Teste A/g)).toHaveLength(1);
  });
});

describe('plano de abordagem', () => {
  const visao = (id: string, nome: string, situacao: VisaoDoador['situacao']): VisaoDoador => ({
    doador: { id, nome, email: null, celular: '(12) 90000-0000', aceita_email: true, aceita_ligacao: true, aceita_sms: false, aceita_whatsapp: true, aceita_cartas: false, aceita_mala_direta: false },
    doacoes: [], principal: { id: 'x' + id, doador_id: id, valor: 50, frequencia: 'Mensal', meio_pagamento: 'Cartão de crédito', status: 'Ativa', status_ultima_cobranca: 'Recusada', ultima_cobranca_paga: null, criada_em: '2026-01-10', finalizada_em: null, campanha: null },
    cobrancas: [], situacao, mesesAtraso: situacao === 'em_dia' ? 0 : situacao === 'atraso_2' ? 2 : 1,
    atrasoDesde: situacao === 'atraso_2' ? '2026-09-05' : situacao === 'atraso_1' ? '2026-10-05' : null, falha: { motivo: 'atualizar_cartao', mensagem: 'Cartão vencido' },
    plano: null, marco: null, brindeDevido: null, brinde: null, rel: { doador_id: id, responsavel: 'membro@casd.test', proximo_contato: '2026-11-10', status_conversa: 'aguardando_resposta', anotacoes: 'Pediu para ligar à noite' },
    pontual: null, virouMensal: false, valorAlto: false,
  });

  it('escreve a aba Inadimplentes: atrasados primeiro, regularizados no fim', async () => {
    const visoes = [visao('D1', 'Pessoa Inventada Um', 'atraso_1'), visao('D2', 'Pessoa Inventada Dois', 'atraso_2'), visao('D3', 'Pessoa Em Dia', 'em_dia'), visao('D4', 'Nunca Atrasou', 'em_dia')];
    const contatos = [
      { doador_id: 'D2', membro: 'membro@casd.test', canal: 'whatsapp', motivo: 'cobranca', resultado: 'Vai atualizar o cartão', nota: null, criado_em: '2026-11-02T12:00:00Z' },
      { doador_id: 'D3', membro: 'membro@casd.test', canal: 'whatsapp', motivo: 'cobranca', resultado: 'Pagou', nota: null, criado_em: '2026-10-20T12:00:00Z' },
    ];
    const exp = exportarInadimplentes(visoes, contatos, () => 'Membro Teste', '2026-11-06');
    const linhas = exp.abas[0].itens as { regularizado: boolean }[];
    expect(linhas).toHaveLength(3);
    const col = (t: string) => exp.abas[0].colunas.find((c) => c.titulo === t)!;
    expect(col('Tempo de inadimplência').valor(linhas[0])).toBe('2 meses');
    expect(col('Valor em aberto').valor(linhas[0])).toBe(100);
    expect(col('Mês').valor(linhas[0])).toBe('Setembro/2026');
    expect(col('Tempo de inadimplência').valor(linhas[2])).toBe('Regularizado');
    expect(col('Status da abordagem').valor(linhas[2])).toBe('Apoio confirmado');

    const r = await preencherXlsx(modelo('abordagem'), exp.abas);
    const s = await aba(r.bytes, 'Inadimplentes');
    expect(s.celula('C3')).toContain('Pessoa Inventada Dois');
    expect(s.celula('C4')).toContain('Pessoa Inventada Um');
    expect(s.celula('C5')).toContain('Pessoa Em Dia');
    expect(s.celula('I3')).toBe('<v>46328</v>'); // 1º contato em 02/11/2026
    expect(s.xml).not.toContain('Nunca Atrasou');
  });

  it('preenche a aba de parcerias PJ', async () => {
    const p: Parceria = {
      id: 'p', organizacao: 'Empresa Inventada', pessoa: 'Contato Teste', cargo: 'Gerente', email: 'contato@exemplo.com', telefone: null,
      rede_social: null, contexto: null, canal: 'LinkedIn', mensagem: null, tipo: 'Patrocínio incentivado', responsavel: 'Membro',
      contato_1: '2026-11-03', contato_2: null, contato_3: null, contato_4: null, ultimo_retorno: null, proxima_acao: 'Enviar proposta',
      status: 'reuniao_marcada', interesse: 'quente', observacoes: null,
    };
    const r = await preencherXlsx(modelo('abordagem'), exportarParcerias([p]).abas);
    const s = await aba(r.bytes, 'Parcerias e Doações PJ');
    expect(s.celula('B3')).toContain('Empresa Inventada');
    expect(s.celula('M3')).toBe('<v>46329</v>');
    expect(s.celula('S3')).toContain('Reunião marcada');
  });
});
