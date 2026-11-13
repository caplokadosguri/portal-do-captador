import { describe, expect, it } from 'vitest';
import { diasAteAniversario, proximoAniversario, rotuloAniversario } from './aniversario';
import { preencherModelo } from './contato';
import { lerRelatorio } from './relatorios';
import { situacao } from './situacao';

describe('aniversário dos doadores', () => {
  it('próximo aniversário, virada de ano e 29 de fevereiro', () => {
    expect(proximoAniversario(14, 11, '2026-11-11')).toBe('2026-11-14');
    expect(proximoAniversario(5, 1, '2026-12-30')).toBe('2027-01-05');
    expect(proximoAniversario(29, 2, '2027-01-10')).toBe('2027-02-28');
    expect(diasAteAniversario(11, 11, '2026-11-11')).toBe(0);
    expect(diasAteAniversario(10, 11, '2026-11-11')).toBe(364);
    expect(diasAteAniversario(null, 11, '2026-11-11')).toBeNull();
    expect(rotuloAniversario(12, 11, '2026-11-11')).toBe('amanhã');
    expect(rotuloAniversario(14, 11, '2026-11-11')).toBe('sáb, 14/11');
  });

  it('a importação guarda só dia e mês do nascimento e se há endereço', () => {
    const csv =
      'Nome,Documento,Data de nascimento, Gênero,Email,Receber e-mails,Receber WhatsApp,CEP,Rua,Número,Bairro,Cidade,Estado,ID do doador\n' +
      'Pessoa Teste,00000000000,2/3/1990,female,teste@exemplo.org,true,true,12200000,Rua Teste,10,Bairro Teste,Cidade Teste,SP,P1\n' +
      'Outra Pessoa,11111111111,29/2/1988,male,outra@exemplo.org,false,true,,,,,,,P2';
    const r = lerRelatorio('doadores', csv);
    expect(r.linhas[0]).toMatchObject({ id: 'P1', nome: 'Pessoa Teste', email: 'teste@exemplo.org', nascimento_dia: 2, nascimento_mes: 3, tem_endereco: true, aceita_whatsapp: true });
    expect(r.linhas[1]).toMatchObject({ id: 'P2', nascimento_dia: 29, nascimento_mes: 2, tem_endereco: false });
    expect(JSON.stringify(r.linhas)).not.toMatch(/1990|1988|Rua Teste|12200000|00000000000|Cidade Teste/);
  });
});

describe('cadastros sem doação', () => {
  it('quem está só no relatório de doadores é lead, não "sem dados de cobrança"', () => {
    expect(situacao(null, [], '2026-11-11')).toBe('sem_doacao');
  });
});

describe('mensagens do plano', () => {
  it('preenche membro, brinde e tempo', () => {
    const t = preencherModelo('Oi, {nome}! Aqui é {membro}. Separamos {brinde}. Você completa {tempo}.', {
      nome: 'Pessoa Teste', membro: 'Membro Exemplo', brinde: null, tempo: '1 ano e meio',
    });
    expect(t).toBe('Oi, Pessoa! Aqui é Membro. Separamos um presente. Você completa 1 ano e meio.');
    expect(preencherModelo('{brinde}', { brinde: 'uma caneca' })).toBe('uma caneca');
  });
});

describe('cadastros para converter', () => {
  it('só cadastros sem doação, recentes, com aceite e não resolvidos; mais recentes primeiro', async () => {
    const { montarFileiras } = await import('./carteira');
    const v = (id: string, cadastrado_em: string | null, x: { whats?: boolean; status?: string; situacao?: string } = {}) => ({
      doador: { id, nome: id, email: null, celular: null, aceita_email: false, aceita_ligacao: false, aceita_sms: false, aceita_whatsapp: x.whats ?? true, aceita_cartas: false, aceita_mala_direta: false, cadastrado_em },
      doacoes: [], principal: null, cobrancas: [], situacao: x.situacao ?? 'sem_doacao', mesesAtraso: null, atrasoDesde: null, falha: null, plano: null,
      brindeDevido: null, brinde: null, rel: x.status ? { doador_id: id, responsavel: null, proximo_contato: null, status_conversa: x.status, anotacoes: null } : null,
      pontual: null, virouMensal: false, valorAlto: false,
    });
    const visoes = [
      v('Antigo', '2025-01-10'), v('Recente', '2026-11-01'), v('Mais recente', '2026-11-09'),
      v('Sem aceite', '2026-11-05', { whats: false }), v('Resolvido', '2026-11-05', { status: 'resolvido' }),
      v('Doador', '2026-11-05', { situacao: 'em_dia' }),
    ];
    const f = montarFileiras({ hoje: '2026-11-11', dadosDe: null, modelos: [], visoes } as never);
    expect(f.find((x) => x.chave === 'cadastros')!.itens.map((x) => x.doador.id)).toEqual(['Mais recente', 'Recente']);
  });
});

describe('ordem por data nas fileiras e tipos de contato', () => {
  it('atrasos do mais antigo, checkpoints do mais próximo, cancelados do mais recente', async () => {
    const { montarFileiras } = await import('./carteira');
    const base = (id: string, x: object) => ({
      doador: { id, nome: id, email: null, celular: null, aceita_email: true, aceita_ligacao: false, aceita_sms: false, aceita_whatsapp: true, aceita_cartas: false, aceita_mala_direta: false },
      doacoes: [], principal: null, cobrancas: [], mesesAtraso: null, atrasoDesde: null, falha: null, plano: null,
      brindeDevido: null, brinde: null, rel: null, pontual: null, virouMensal: false, valorAlto: false, ...x,
    });
    const plano = (dataProximo: string) => ({ atual: null, proximo: { chave: 'x', nome: 'x', meses: 6, brinde: true }, dataProximo, mesesDeDoacao: 5 });
    const visoes = [
      base('A', { situacao: 'atraso_1', atrasoDesde: '2026-10-20' }),
      base('B', { situacao: 'atraso_1', atrasoDesde: '2026-10-05' }),
      base('C', { situacao: 'em_dia', plano: plano('2026-11-16'), marco: { checkpoint: { chave: 'meses_6', nome: '6 meses' }, data: '2026-11-16', dias: 5 } }),
      base('D', { situacao: 'em_dia', plano: plano('2026-11-12'), marco: { checkpoint: { chave: 'ano_1', nome: '1 ano' }, data: '2026-11-08', dias: -3 } }),
      base('G', { situacao: 'em_dia', plano: plano('2027-02-01'), marco: null }),
      base('E', { situacao: 'cancelado', principal: { finalizada_em: '2026-01-01' } }),
      base('F', { situacao: 'cancelado', principal: { finalizada_em: '2026-09-01' } }),
    ];
    const f = montarFileiras({ hoje: '2026-11-11', dadosDe: null, modelos: [], visoes } as never);
    const ids = (k: string) => f.find((x) => x.chave === k)!.itens.map((v) => v.doador.id);
    expect(ids('atraso_1')).toEqual(['B', 'A']);
    expect(ids('checkpoints')).toEqual(['D', 'C']);
    expect(ids('em_dia')).toEqual(['D', 'C', 'G']);
    expect(ids('cancelado')).toEqual(['F', 'E']);
  });

  it('o tipo do contato vem do modelo usado, não da situação do doador', async () => {
    const { motivoDoModelo } = await import('./contato');
    expect(motivoDoModelo('aniversario')).toBe('aniversario');
    expect(motivoDoModelo('cartao_vencido')).toBe('cobranca');
    expect(motivoDoModelo('ano_1')).toBe('plano');
    expect(motivoDoModelo('lead_convite')).toBe('lead');
  });
});

describe('doação única não paga', () => {
  it('Pix ou boleto "Inativa"/"Pendente" sem pagamento não é doação pontual', async () => {
    const { situacao, doacaoPrincipal } = await import('./situacao');
    const base = { doador_id: 'P1', valor: 50, meio_pagamento: 'Pix', status_ultima_cobranca: null, finalizada_em: null, campanha: null, frequencia: 'Única' };
    const naoPaga = { ...base, id: 'D2', status: 'Inativa', ultima_cobranca_paga: null, criada_em: '2026-06-01' };
    const paga = { ...base, id: 'D1', status: 'Finalizada', ultima_cobranca_paga: '2025-03-01', criada_em: '2025-03-01' };
    expect(situacao(naoPaga, [], '2026-11-11')).toBe('sem_doacao');
    expect(situacao({ ...naoPaga, status: 'Pendente' }, [], '2026-11-11')).toBe('sem_doacao');
    expect(doacaoPrincipal([naoPaga, paga])!.id).toBe('D1');
    expect(situacao(doacaoPrincipal([naoPaga, paga]), [], '2026-11-11')).toBe('pontual');
  });
});

describe('marco do plano no dia e atrasado', () => {
  it('no dia do marco ele aparece como hoje; depois, atrasado até a mensagem ser enviada', async () => {
    const { marcoDoPlano } = await import('./situacao');
    // Doação criada em 13/05/2026: marco de 6 meses em 13/11/2026.
    expect(marcoDoPlano('2026-05-13', '2026-11-13', null)).toMatchObject({ checkpoint: { chave: 'meses_6' }, dias: 0 });
    expect(marcoDoPlano('2026-05-13', '2026-11-20', null)).toMatchObject({ checkpoint: { chave: 'meses_6' }, dias: -7 });
    // Mensagem do plano enviada no dia: sai; o próximo marco (1 ano) ainda está longe.
    expect(marcoDoPlano('2026-05-13', '2026-11-20', '2026-11-13T15:00:00Z')).toBeNull();
    // Mais de 30 dias de atraso: sai da fileira.
    expect(marcoDoPlano('2026-05-13', '2026-12-20', null)).toBeNull();
    // Chegando em 5 dias.
    expect(marcoDoPlano('2026-05-13', '2026-11-08', '2026-01-01')).toMatchObject({ checkpoint: { chave: 'meses_6' }, dias: 5 });
    // Doação nova: boas-vindas no próprio dia.
    expect(marcoDoPlano('2026-11-13', '2026-11-13', null)).toMatchObject({ checkpoint: { chave: 'inicio' }, dias: 0 });
  });
});

describe('lembrete de marco dispensado', () => {
  it('sai da fileira sem precisar de contato registrado', async () => {
    const { marcoDoPlano } = await import('./situacao');
    expect(marcoDoPlano('2026-05-13', '2026-11-13', null, new Set(['2026-11-13']))).toBeNull();
    // Dispensar o de 6 meses não esconde o de 1 ano quando ele chegar.
    expect(marcoDoPlano('2026-05-13', '2027-05-13', null, new Set(['2026-11-13']))).toMatchObject({ checkpoint: { chave: 'ano_1' }, dias: 0 });
    // Lembrete de marco que ainda vai chegar também pode ser dispensado.
    expect(marcoDoPlano('2026-05-13', '2026-11-10', null, new Set(['2026-11-13']))).toBeNull();
  });
});
