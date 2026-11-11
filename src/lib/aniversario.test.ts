import { describe, expect, it } from 'vitest';
import { diasAteAniversario, proximoAniversario, rotuloAniversario } from './aniversario';
import { preencherModelo } from './contato';
import { lerRelatorio } from './relatorios';

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
    expect(r.linhas[0]).toMatchObject({ id: 'P1', nascimento_dia: 2, nascimento_mes: 3, tem_endereco: true, aceita_whatsapp: true });
    expect(r.linhas[1]).toMatchObject({ id: 'P2', nascimento_dia: 29, nascimento_mes: 2, tem_endereco: false });
    expect(JSON.stringify(r.linhas)).not.toMatch(/1990|1988|Rua Teste|12200000|00000000000|Cidade Teste/);
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
