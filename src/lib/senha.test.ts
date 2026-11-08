import { describe, expect, it } from 'vitest';
import { precisaCriarSenha, problemasDaSenha } from './senha';

describe('senha do portal', () => {
  it('aceita senha razoável e recusa as fáceis de adivinhar', () => {
    expect(problemasDaSenha('Trem7azul!', 'Trem7azul!', 'fulano.teste@exemplo.org', 'Fulano Teste')).toEqual([]);
    expect(problemasDaSenha('FulanoCASD', 'FulanoCASD', 'fulano.teste@exemplo.org', 'Fulano Teste').join(' ')).toMatch(/nome/);
    expect(problemasDaSenha('abc123', 'abc123')).toContain('Use pelo menos 8 caracteres.');
    expect(problemasDaSenha('somenteletras', 'somenteletras')).toContain('Misture letras e números.');
    expect(problemasDaSenha('Trem7azul!', 'Trem7azul?')).toContain('As duas senhas não são iguais.');
  });

  it('manda criar a senha no primeiro acesso e depois de "Esqueci minha senha"', () => {
    expect(precisaCriarSenha({}, false)).toBe(true);
    expect(precisaCriarSenha(undefined, false)).toBe(true);
    expect(precisaCriarSenha({ senha_definida: true }, false)).toBe(false);
    expect(precisaCriarSenha({ senha_definida: true }, true)).toBe(true);
  });
});
