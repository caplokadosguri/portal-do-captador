'use client';

import Link from 'next/link';

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
  return (
    <div className="tela-escura">
      <main className="pagina suave" aria-busy="true" style={{ paddingTop: 96 }}>Carregando…</main>
    </div>
  );
}
