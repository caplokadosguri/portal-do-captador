'use client';

import Cabecalho, { Carregando, SemAcesso } from '@/components/Cabecalho';
import { Papel, podeVer, useMembro } from '@/lib/membro';

/** Área ainda não construída no piloto. */
export default function EmBreve({ papel, titulo, texto }: { papel: Papel; titulo: string; texto: string }) {
  const { carregando, membro, email } = useMembro();
  if (carregando) return <Carregando />;
  if (!podeVer(membro, papel)) return <SemAcesso email={email} />;
  return (
    <>
      <Cabecalho membro={membro} />
      <main className="pagina pilha">
        <h1 style={{ fontSize: 28 }}>{titulo}</h1>
        <p className="aviso">{texto}</p>
      </main>
    </>
  );
}
