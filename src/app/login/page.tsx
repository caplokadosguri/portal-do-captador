'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/cliente';

export default function Login() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'enviado' | 'erro'>('livre');
  const [erro, setErro] = useState('');

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
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

  return (
    <main className="pagina" style={{ maxWidth: 440, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/casd-logo.svg" alt="CASD — Curso Alberto Santos Dumont" style={{ width: 260, height: 'auto' }} />
      <h1 style={{ fontSize: 28 }}>Portal do Captador</h1>
      {estado === 'enviado' ? (
        <p className="aviso ok">Enviamos um link de acesso para {email}. Abra o e-mail neste aparelho para entrar.</p>
      ) : (
        <form onSubmit={entrar} className="pilha">
          <label className="campo">
            E-mail institucional
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
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
