// Login por senha: primeiro acesso pelo link do e-mail, depois e-mail + senha.

/** Cookie posto pela tela de login em "Esqueci minha senha": depois do link, o proxy leva para /senha. */
export const COOKIE_REDEFINIR = 'portal_redefinir_senha';

/** Marca no perfil do Supabase Auth (user_metadata) de que a pessoa já criou a senha. */
export const MARCA_SENHA = 'senha_definida';

export const TAMANHO_MINIMO = 8;

/** Problemas da senha escolhida, em português; lista vazia = pode salvar. */
export function problemasDaSenha(senha: string, confirmacao: string, email = '', nome = ''): string[] {
  const p: string[] = [];
  const s = senha.toLowerCase();
  if (senha.length < TAMANHO_MINIMO) p.push(`Use pelo menos ${TAMANHO_MINIMO} caracteres.`);
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) p.push('Misture letras e números.');
  const usuario = email.split('@')[0].toLowerCase();
  const primeiroNome = nome.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if ((usuario.length >= 4 && s.includes(usuario)) || (primeiroNome.length >= 3 && s.includes(primeiroNome)) || s.includes('casd')) {
    p.push('Não use seu nome, seu e-mail ou “CASD” na senha: são fáceis de adivinhar.');
  }
  if (confirmacao && senha !== confirmacao) p.push('As duas senhas não são iguais.');
  return p;
}

/** Precisa passar pela tela de criar senha? */
export function precisaCriarSenha(metadados: Record<string, unknown> | undefined, cookieRedefinir: boolean): boolean {
  return cookieRedefinir || metadados?.[MARCA_SENHA] !== true;
}
