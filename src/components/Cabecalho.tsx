'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/cliente';
import type { Membro } from '@/lib/membro';

export default function Cabecalho({ membro }: { membro: Membro | null }) {
  const router = useRouter();
  async function sair() {
    await supabase().auth.signOut();
    router.replace('/login');
  }
  return (
    <header className="cabecalho">
      <div className="cabecalho-dentro">
        <Link href="/" className="marca" aria-label="Voltar para os perfis">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/casd-logo.svg" alt="CASD" />
          <span className="flix">FLIX</span>
        </Link>
        <nav aria-label="Conta">
          {membro && <span className="suave pequeno" style={{ alignSelf: 'center' }}>{membro.nome}</span>}
          <Link href="/" className="botao secundario">Trocar perfil</Link>
          <button type="button" className="botao secundario" onClick={sair}>Sair</button>
        </nav>
      </div>
    </header>
  );
}

export function SemAcesso({ email }: { email: string | null }) {
  return (
    <main className="pagina pilha">
      <h1>Acesso ainda não liberado</h1>
      <p className="suave">
        {email ? `O e-mail ${email} ainda não está cadastrado no portal.` : 'Entre com o seu e-mail institucional.'} Fale com o
        diretor de Captação para liberar o seu perfil.
      </p>
      <Link className="botao secundario" href="/login" style={{ alignSelf: 'flex-start' }}>Voltar ao login</Link>
    </main>
  );
}

export function Carregando() {
  return <main className="pagina suave" aria-busy="true">Carregando…</main>;
}
