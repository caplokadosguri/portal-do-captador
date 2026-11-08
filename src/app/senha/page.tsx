'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMembro } from '@/lib/membro';
import { COOKIE_REDEFINIR, MARCA_SENHA, problemasDaSenha, TAMANHO_MINIMO } from '@/lib/senha';
import { supabase } from '@/lib/supabase/cliente';

// Criar (no primeiro acesso), redefinir (depois de "Esqueci minha senha") ou trocar a senha.
export default function CriarSenha() {
  const router = useRouter();
  const { email, membro } = useMembro();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ver, setVer] = useState(false);
  const [estado, setEstado] = useState<'livre' | 'salvando' | 'erro'>('livre');
  const [erro, setErro] = useState('');

  const problemas = problemasDaSenha(senha, confirmacao, email ?? '', membro?.nome ?? '');
  const pronta = senha.length > 0 && confirmacao.length > 0 && problemas.length === 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pronta) return;
    setEstado('salvando');
    const { error } = await supabase().auth.updateUser({ password: senha, data: { [MARCA_SENHA]: true } });
    if (error) {
      const msg = error.message;
      setErro(
        /same password|different from the old/i.test(msg)
          ? 'É a mesma senha de antes. Escolha outra.'
          : /reauthenticat|recent/i.test(msg)
            ? 'Por segurança, entre de novo pelo link do e-mail (Esqueci minha senha) e crie a senha logo em seguida.'
            : /weak|pwned|leaked/i.test(msg)
              ? 'Essa senha é fraca ou já apareceu em vazamentos. Escolha outra.'
              : msg,
      );
      setEstado('erro');
      return;
    }
    document.cookie = `${COOKIE_REDEFINIR}=; path=/; max-age=0`;
    router.replace('/');
    router.refresh();
  }

  async function sair() {
    await supabase().auth.signOut();
    document.cookie = `${COOKIE_REDEFINIR}=; path=/; max-age=0`;
    router.replace('/login');
  }

  return (
    <main className="pagina" style={{ maxWidth: 440, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/casd-logo.svg" alt="CASD — Curso Alberto Santos Dumont" style={{ width: 220, height: 'auto' }} />
      <h1 style={{ fontSize: 26 }}>Crie sua senha</h1>
      <p className="suave" style={{ margin: 0 }}>
        {email ? <>Para <strong>{email}</strong>. </> : null}
        Nas próximas vezes você entra só com e-mail e senha, sem esperar link.
      </p>
      <form onSubmit={salvar} className="pilha">
        <label className="campo">
          Senha nova
          <input type={ver ? 'text' : 'password'} required autoComplete="new-password" minLength={TAMANHO_MINIMO} value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <label className="campo">
          Repita a senha
          <input type={ver ? 'text' : 'password'} required autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </label>
        <label className="linha pequeno" style={{ gap: 8 }}>
          <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar senha
        </label>
        {senha && problemas.length > 0 && (
          <ul className="pequeno suave" style={{ margin: 0, paddingLeft: 18 }}>{problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        )}
        <button className="botao" type="submit" disabled={!pronta || estado === 'salvando'}>
          {estado === 'salvando' ? 'Salvando…' : 'Salvar senha e entrar'}
        </button>
        {estado === 'erro' && <p className="aviso erro">{erro}</p>}
      </form>
      <p className="suave pequeno">
        A senha é só sua: ninguém da Captação, nem o diretor, consegue vê-la. Esqueceu? Na tela de entrada, use “Esqueci minha senha”.{' '}
        <button type="button" className="botao-link" style={{ padding: 0 }} onClick={sair}>Sair</button>
      </p>
    </main>
  );
}
