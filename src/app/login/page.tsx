'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/cliente';
import { COOKIE_REDEFINIR } from '@/lib/senha';

type Aba = 'senha' | 'link';

export default function Login() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('senha');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'enviado' | 'erro'>('livre');
  const [erro, setErro] = useState('');
  const [esqueci, setEsqueci] = useState(false);

  const emailLimpo = () => email.trim().toLowerCase();
  const trocar = (a: Aba, esqueceu = false) => {
    setAba(a);
    setEsqueci(esqueceu);
    setEstado('livre');
    setErro('');
  };

  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    const { error } = await supabase().auth.signInWithPassword({ email: emailLimpo(), password: senha });
    if (error) {
      setErro(
        /invalid login credentials/i.test(error.message)
          ? 'E-mail ou senha incorretos. Se ainda não criou sua senha, use “Primeiro acesso”.'
          : error.message,
      );
      setEstado('erro');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    // Quem esqueceu a senha cai direto na tela de criar senha nova depois do link.
    document.cookie = esqueci ? `${COOKIE_REDEFINIR}=1; path=/; max-age=3600; samesite=lax` : `${COOKIE_REDEFINIR}=; path=/; max-age=0`;
    const { error } = await supabase().auth.signInWithOtp({
      email: emailLimpo(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true },
    });
    if (error) {
      setErro(error.message);
      setEstado('erro');
    } else setEstado('enviado');
  }

  async function google() {
    await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  const campoEmail = (
    <label className="campo">
      E-mail institucional
      <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
    </label>
  );

  return (
    <main className="pagina" style={{ maxWidth: 440, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/casd-logo.svg" alt="CASD — Curso Alberto Santos Dumont" style={{ width: 260, height: 'auto' }} />
      <h1 style={{ fontSize: 28 }}>Portal do Captador</h1>

      <div className="abas-login" role="tablist" aria-label="Como entrar">
        <button type="button" role="tab" aria-selected={aba === 'senha'} onClick={() => trocar('senha')}>Entrar com senha</button>
        <button type="button" role="tab" aria-selected={aba === 'link'} onClick={() => trocar('link')}>Primeiro acesso</button>
      </div>

      {aba === 'senha' ? (
        <form onSubmit={entrarComSenha} className="pilha">
          {campoEmail}
          <label className="campo">
            Senha
            <input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </label>
          <button className="botao" type="submit" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Entrando…' : 'Entrar'}</button>
          {estado === 'erro' && <p className="aviso erro">{erro}</p>}
          <button type="button" className="botao-link" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => trocar('link', true)}>
            Esqueci minha senha
          </button>
        </form>
      ) : estado === 'enviado' ? (
        <p className="aviso ok">
          Enviamos um link de acesso para {emailLimpo()}. Abra o e-mail <strong>neste aparelho e neste navegador</strong>;
          depois de entrar, você cria {esqueci ? 'uma senha nova' : 'sua senha'} e não precisa mais do link.
        </p>
      ) : (
        <form onSubmit={enviarLink} className="pilha">
          <p className="suave pequeno" style={{ margin: 0 }}>
            {esqueci
              ? 'Mandamos um link para o seu e-mail. Ao entrar por ele, você cria uma senha nova.'
              : 'Na primeira vez, você entra por um link enviado ao seu e-mail e cria sua senha. Depois é só e-mail e senha.'}
          </p>
          {campoEmail}
          <button className="botao" type="submit" disabled={estado === 'enviando'}>
            {estado === 'enviando' ? 'Enviando…' : 'Receber link de acesso'}
          </button>
          {process.env.NEXT_PUBLIC_LOGIN_GOOGLE === 'sim' && (
            <button className="botao secundario" type="button" onClick={google}>Entrar com Google</button>
          )}
          {estado === 'erro' && <p className="aviso erro">Não deu certo: {erro}</p>}
        </form>
      )}
      <p className="suave pequeno">Só membros cadastrados pelo diretor de Captação veem os dados.</p>
    </main>
  );
}
