// Subabas dos eventos e resumo financeiro, com dados inventados.
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Evento } from './eventos';
import { DetalhesEventos, financeiro, GastoEvento, PatrocinioEvento, tarefasPendentes } from './eventosDetalhe';
import { COLUNAS_PROJETOS, exportarEventos } from './exportacoes';
import { camposDoResumo, faltandoNoResumo, nomeDoResumo } from './resumoProjeto';
import type { Projeto } from './editais';

const ev = (id: string, nome: string, x: Partial<Evento> = {}): Evento => ({
  id, nome, tipos: ['captacao'], situacao: 'aprovado', frequencia: 'unico', previsao: null, inicio: null, fim: null, data_confirmada: false,
  local: null, responsavel: null, meta: null, arrecadado: null, cotas: null, descricao: null, link: null, ...x,
});
const gasto = (id: string, x: Partial<GastoEvento>): GastoEvento => ({
  id, evento_id: 'a', descricao: id, categoria: null, fornecedor: null, previsto: null, realizado: null, situacao: 'previsto', data: null, comprovante: null, ...x,
});
const patro = (id: string, x: Partial<PatrocinioEvento>): PatrocinioEvento => ({
  id, evento_id: 'a', parceria_id: null, empresa: `Empresa ${id}`, cota: null, valor: null, contrapartidas: null, situacao: 'prospectado', contato: null, observacao: null, ...x,
});

const detalhes: DetalhesEventos = {
  metas: [{ id: 'm1', evento_id: 'a', descricao: 'Público', unidade: 'pessoas', alvo: 200, atual: 50, observacao: null }],
  gastos: [
    gasto('Espaço', { previsto: 1000, realizado: 1200, situacao: 'pago' }),
    gasto('Lanche', { previsto: 300, situacao: 'pago' }), // pago sem valor realizado: conta o previsto
    gasto('Camisetas', { previsto: 800, situacao: 'aprovado' }), // ainda não gasto
    gasto('Som', { previsto: 500, realizado: 500, situacao: 'cancelado' }), // cancelado não conta
    gasto('Outro evento', { evento_id: 'b', previsto: 99, realizado: 99, situacao: 'pago' }),
    gasto('Evento apagado', { evento_id: 'zz', previsto: 1, situacao: 'pago' }),
  ],
  patrocinadores: [
    patro('A', { valor: 2000, situacao: 'recebido' }),
    patro('B', { valor: 1000, situacao: 'confirmado' }),
    patro('C', { valor: 5000, situacao: 'em_negociacao' }),
    patro('D', { valor: 3000, situacao: 'recusado' }),
  ],
  tarefas: [
    { id: 't1', evento_id: 'a', descricao: 'Reservar quadra', responsavel: null, prazo: '2026-11-01', feita: false },
    { id: 't2', evento_id: 'a', descricao: 'Arte do convite', responsavel: null, prazo: '2026-12-01', feita: false },
    { id: 't3', evento_id: 'a', descricao: 'Orçamentos', responsavel: null, prazo: '2026-10-01', feita: true },
    { id: 't4', evento_id: 'a', descricao: 'Sem prazo', responsavel: null, prazo: null, feita: false },
  ],
};
const a = ev('a', 'Jogo Teste', { meta: 10000, arrecadado: 1500, inicio: '2027-05-10', fim: '2027-05-10' });
const b = ev('b', 'Bazar Teste', { inicio: '2027-01-10', fim: '2027-01-10' });

describe('resumo financeiro do evento', () => {
  it('soma sem contar duas vezes: patrocínio só quando recebido, gasto só quando realizado', () => {
    const f = financeiro(a, detalhes.gastos, detalhes.patrocinadores);
    expect(f.arrecadado).toBe(1500);
    expect(f.patrocinioRecebido).toBe(2000);
    expect(f.patrocinioAReceber).toBe(1000);
    expect(f.patrocinioEmConversa).toBe(5000);
    expect(f.captado).toBe(3500);
    expect(f.gastosRealizados).toBe(1500); // 1200 + 300
    expect(f.gastosPrevistos).toBe(2300); // 1200 (gastou mais que o previsto) + 300 + 800
    expect(f.saldo).toBe(2000);
    expect(f.saldoPrevisto).toBe(3500 + 1000 - 2300);
    expect(f.progresso).toBeCloseTo(0.35);
  });

  it('evento sem nada: tudo zero e sem progresso', () => {
    const f = financeiro(ev('x', 'Vazio'), [], []);
    expect(f).toMatchObject({ captado: 0, saldo: 0, progresso: null });
  });

  it('tarefas pendentes por prazo, sem as feitas', () => {
    expect(tarefasPendentes(detalhes.tarefas, 'a').map((t) => t.id)).toEqual(['t1', 't2', 't4']);
  });
});

describe('planilha de eventos com subabas', () => {
  it('cada subaba leva o nome do evento, segue a ordem do calendário e ignora eventos apagados', () => {
    const exp = exportarEventos([a, b], '2026-11-07', detalhes);
    expect(exp.abas.map((x) => x.aba)).toEqual(['Eventos', 'Metas', 'Gastos', 'Patrocinadores', 'Tarefas']);
    const gastos = exp.abas[2];
    const nomes = (gastos.itens as { evento: string; descricao: string }[]).map((g) => `${g.evento}/${g.descricao}`);
    expect(nomes[0]).toBe('Bazar Teste/Outro evento'); // janeiro vem antes de maio
    expect(nomes).not.toContain('Evento apagado');
    expect(gastos.chave).toEqual(['Evento', 'Descrição']);
    const linhaA = (exp.abas[0].itens as { id: string; contas?: { saldo: number } }[]).find((x) => x.id === 'a')!;
    expect(linhaA.contas?.saldo).toBe(2000);
    const saldo = exp.abas[0].colunas.find((c) => c.titulo === 'Saldo')!;
    expect(saldo.valor(linhaA as never)).toBe(2000);
    const pct = exp.abas[1].colunas.find((c) => c.titulo === '% atingido')!;
    expect(pct.valor({ ...detalhes.metas[0], evento: 'Jogo Teste' } as never)).toBe(0.25);
  });

  it('o modelo eventos.xlsx tem as abas e as colunas que o portal escreve', async () => {
    const zip = await JSZip.loadAsync(await readFile('public/modelos/eventos.xlsx'));
    const livro = await zip.file('xl/workbook.xml')!.async('string');
    let strings = '';
    for (const n of Object.keys(zip.files).filter((n) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(n))) strings += await zip.file(n)!.async('string');
    const textos = strings.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    const exp = exportarEventos([a], '2026-11-07', detalhes);
    for (const aba of exp.abas) {
      expect(livro).toContain(`name="${aba.aba}"`);
      const faltando = aba.colunas.filter((c) => !textos.includes(`>${c.titulo}<`)).map((c) => `${aba.aba}: ${c.titulo}`);
      expect(faltando).toEqual([]);
    }
  });
});

describe('resumo de escopo do projeto', () => {
  it('o modelo projetos.xlsx já traz as colunas novas', async () => {
    const zip = await JSZip.loadAsync(await readFile('public/modelos/projetos.xlsx'));
    const xml = (await zip.file('xl/worksheets/sheet1.xml')!.async('string')).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    expect(COLUNAS_PROJETOS.filter((c) => !xml.includes(`>${c.titulo}<`)).map((c) => c.titulo)).toEqual([]);
  });

  const p = {
    id: 'p', titulo: 'Projeto Teste', escopo: 'Aulas aos sábados', quem_pediu: null, esfera: 'CASDvest', publico_atendido: 120, orcamento: 15000,
    status: 'em_elaboracao', link_documentos: null, objetivo: 'Ampliar turmas', justificativa: null, publico_alvo: null,
  } as unknown as Projeto;

  it('avisa o que falta e monta o nome com a data', () => {
    expect(faltandoNoResumo(p)).toEqual(['Justificativa', 'Público-alvo']);
    expect(nomeDoResumo(p, '2026-11-07')).toBe('Resumo de escopo – Projeto Teste – 07/11/2026');
  });

  it('preenche exatamente os marcadores que existem no modelo resumo-projeto.docx', async () => {
    const zip = await JSZip.loadAsync(await readFile('public/modelos/resumo-projeto.docx'));
    let xml = '';
    for (const n of Object.keys(zip.files).filter((n) => /^word\/(document|footer\d*|header\d*)\.xml$/.test(n))) xml += await zip.file(n)!.async('string');
    const texto = xml.replace(/<[^>]+>/g, '');
    const noModelo = new Set([...texto.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]));
    const campos = camposDoResumo(p, ['Edital Teste'], '2026-11-07', 'Membro Teste');
    expect([...noModelo].sort()).toEqual(Object.keys(campos).sort());
    expect(campos).toMatchObject({ esfera: 'CASDvest', orcamento: expect.stringContaining('15.000'), editais: 'Edital Teste', data: '07/11/2026' });
  });
});
