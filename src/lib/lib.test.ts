// Testes com dados inventados (nenhum dado real de doador).
import { describe, expect, it } from 'vitest';
import { lerRelatorio, separarDoacoes } from './relatorios';
import { brindeDevido, Cobranca, Doacao, doacaoPrincipal, motivoFalha, pontoDoPlano, situacao } from './situacao';
import { linkWhatsApp, preencherModelo, telefoneInternacional, vcard } from './contato';
import { booleano, data, mesesEntre, numero } from './texto';

const CAB_DOACOES =
  'Nome;Documento;Tipo de documento;Tipo de doador;Email;Celular;Tel. Residencial;Canal do doador;Grupo do doador;Campanha do doador;Valor da doação (R$);Status;Meio de pagamento;Convênio;Frequência;Dia de cobrança;Data de finalização;Última cobrança paga;Data de criação da doação;Data de atualização da doação;Status da última cobrança;Canal da doação;Grupo da doação;Campanha da doação;UTM Source;UTM Medium;UTM Campaign;Utm Content;Utm Term;Usuário que criou;Usuário que captou;Usuário que finalizou;ID do doador;ID da doação';

const doacoesCsv = [
  CAB_DOACOES,
  'Ana Teste;000.000.000-00;CPF;PF;ana@exemplo.com;(12) 99999-0000;;Site;;;"50,00";Ativa;Cartão de crédito;;Mensal;5;;05/09/2026;10/01/2026;;Recusada;Site;;Doe;;;;;;;;;D1;A1',
  'Beto Teste;111.111.111-11;CPF;PF;beto@exemplo.com;12988887777;;Site;;;"500,00";Ativa;Pix;;Única;;;01/10/2026;01/10/2026;;Paga;Site;;JdA;;;;;;;;;D2;A2',
  'Sem ID;;;;;;;;;;"10,00";Ativa;Pix;;Mensal;;;;01/10/2026;;;;;;;;;;;;;;;',
].join('\n');

describe('leitura dos relatórios', () => {
  it('importa só as colunas da lista e descarta o resto (CPF, UTMs...)', () => {
    const r = lerRelatorio('doacoes', doacoesCsv);
    expect(r.colunasFaltando).toEqual([]);
    expect(r.linhas).toHaveLength(2);
    expect(r.erros).toEqual([{ linha: 4, motivo: 'sem ID do doador' }]);
    expect(r.colunasDescartadas).toBe(34 - 15);
    const ana = r.linhas[0];
    expect(ana).toMatchObject({ id: 'A1', doador_id: 'D1', valor: 50, frequencia: 'Mensal', criada_em: '2026-01-10', ultima_cobranca_paga: '2026-09-05' });
    expect(JSON.stringify(r.linhas)).not.toContain('000.000.000-00');
    const { doadores, doacoes } = separarDoacoes(r.linhas);
    expect(doadores[0]).toEqual({ id: 'D1', nome: 'Ana Teste', email: 'ana@exemplo.com', celular: '(12) 99999-0000' });
    expect(doacoes[0]).not.toHaveProperty('nome');
  });

  it('avisa quando falta coluna obrigatória', () => {
    const r = lerRelatorio('cobrancas', 'ID da cobrança,Status da cobrança\nC1,Paga');
    expect(r.colunasFaltando).toContain('ID do doador');
    expect(r.linhas).toHaveLength(0);
  });

  it('lê o aceite por canal do relatório de doadores', () => {
    const csv = 'ID do doador,Receber e-mails,Receber ligações,Receber SMS,Receber WhatsApp,Receber cartas,Receber malas diretas\nD1,Sim,Não,Não,Sim,,Não';
    const r = lerRelatorio('doadores', csv);
    expect(r.linhas[0]).toEqual({ id: 'D1', aceita_email: true, aceita_ligacao: false, aceita_sms: false, aceita_whatsapp: true, aceita_cartas: null, aceita_mala_direta: false });
  });
});

describe('conversões', () => {
  it('datas, números e sim/não no padrão brasileiro', () => {
    expect(data('05/11/2026 14:30')).toBe('2026-11-05');
    expect(data('2026-11-05')).toBe('2026-11-05');
    expect(numero('1.234,56')).toBe(1234.56);
    expect(numero('R$ 50,00')).toBe(50);
    expect(numero('50.00')).toBe(50);
    expect(booleano('Não')).toBe(false);
    expect(booleano('')).toBe(null);
    expect(mesesEntre('2026-01-10', '2026-11-06')).toBe(9);
  });
});

const base: Doacao = {
  id: 'A1', doador_id: 'D1', valor: 50, frequencia: 'Mensal', meio_pagamento: 'Cartão', status: 'Ativa',
  status_ultima_cobranca: null, ultima_cobranca_paga: null, criada_em: '2026-01-10', finalizada_em: null, campanha: null,
};
const cob = (id: string, vencimento: string, status: string, erro: string | null = null): Cobranca => ({
  id, doacao_id: 'A1', doador_id: 'D1', vencimento, pago_em: null, status, mensagem_erro: erro,
});

describe('situação de pagamento', () => {
  const hoje = '2026-11-06';
  it('conta meses seguidos sem pagamento', () => {
    const cobrancas = [cob('1', '2026-08-05', 'Paga'), cob('2', '2026-09-05', 'Não paga'), cob('3', '2026-10-05', 'Recusada'), cob('4', '2026-11-05', 'Recusada', 'Cartão vencido')];
    expect(situacao(base, cobrancas, hoje)).toBe('atraso_3');
    expect(situacao(base, cobrancas.slice(0, 2), hoje)).toBe('atraso_1');
    expect(situacao(base, [cob('1', '2026-11-05', 'Paga')], hoje)).toBe('em_dia');
    expect(motivoFalha(cobrancas, 'A1')).toEqual({ motivo: 'atualizar_cartao', mensagem: 'Cartão vencido' });
  });
  it('ignora cobranças que ainda não venceram', () => {
    expect(situacao(base, [cob('1', '2026-10-05', 'Paga'), cob('2', '2026-12-05', 'Pendente')], hoje)).toBe('em_dia');
  });
  it('sem relatório de cobranças, usa a última cobrança paga', () => {
    expect(situacao({ ...base, ultima_cobranca_paga: '2026-08-05' }, [], hoje)).toBe('atraso_2');
  });
  it('pontual e cancelado', () => {
    expect(situacao({ ...base, frequencia: 'Única' }, [], hoje)).toBe('pontual');
    expect(situacao({ ...base, finalizada_em: '2026-10-01' }, [], hoje)).toBe('cancelado');
  });
  it('doação principal prefere a mensal ativa', () => {
    const p = doacaoPrincipal([{ ...base, id: 'P', frequencia: 'Única', criada_em: '2026-10-01' }, base]);
    expect(p?.id).toBe('A1');
  });
});

describe('plano de doadores', () => {
  it('encontra o checkpoint atual e o próximo', () => {
    const p = pontoDoPlano('2025-11-20', '2026-11-06');
    expect(p.atual?.chave).toBe('meses_6');
    expect(p.proximo.chave).toBe('ano_1');
    expect(p.dataProximo).toBe('2026-11-20');
  });
  it('depois de 18 meses segue de 6 em 6', () => {
    expect(pontoDoPlano('2023-01-01', '2026-01-15').atual?.nome).toBe('3 anos');
  });
  it('não dá brinde retroativo a quem alcançou o checkpoint antes do lançamento', () => {
    expect(brindeDevido('2025-11-20', '2026-11-06', '2027-01-01')).toBeNull();
    expect(brindeDevido('2025-11-20', '2026-11-25', '2026-11-01')?.chave).toBe('ano_1');
  });
});

describe('contato', () => {
  it('monta o link de WhatsApp com DDI', () => {
    expect(telefoneInternacional('(12) 99999-0000')).toBe('5512999990000');
    expect(linkWhatsApp('12 99999-0000', 'Oi Ana')).toBe('https://wa.me/5512999990000?text=Oi%20Ana');
    expect(linkWhatsApp('123', 'x')).toBeNull();
  });
  it('preenche o modelo com o primeiro nome e o valor em reais', () => {
    expect(preencherModelo('Oi, {nome}! {valor} há {meses} meses', { nome: 'Ana Teste', valor: 50, meses: 6 })).toBe('Oi, Ana! R$ 50,00 há 6 meses');
  });
  it('gera o arquivo de contato', () => {
    expect(vcard({ nome: 'Ana; Teste', celular: '12999990000', email: null })).toContain('FN:Ana\\; Teste');
  });
});
