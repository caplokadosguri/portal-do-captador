'use client';

import BotaoPlanilha from '@/components/BotaoPlanilha';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import Tela from '@/components/Tela';
import { Destaque, Ferramentas } from '@/components/Vitrine';
import { COLUNAS_EVENTOS, COLUNAS_PARCEIROS, Empresa, Evento } from '@/lib/exportacoes';
import { PERFIS, podeVer, useMembro } from '@/lib/membro';
import type { Exportacao } from '@/lib/planilha';
import { supabase } from '@/lib/supabase/cliente';

async function preparar(papel: 'parceiros' | 'eventos'): Promise<Exportacao<Empresa> | Exportacao<Evento>> {
  const sb = supabase();
  if (papel === 'parceiros') {
    const { data, error } = await sb.from('empresas').select('*').order('nome');
    if (error) throw new Error(error.message);
    return { setor: 'parceiros', nome: 'Parceiros', colunas: COLUNAS_PARCEIROS, itens: (data ?? []) as Empresa[] };
  }
  const { data, error } = await sb.from('eventos').select('*').order('data');
  if (error) throw new Error(error.message);
  return { setor: 'eventos', nome: 'Eventos', colunas: COLUNAS_EVENTOS, itens: (data ?? []) as Evento[] };
}

/** Área ainda não construída no piloto (já com o botão de planilha). */
export default function EmBreve({ papel, titulo, texto }: { papel: 'parceiros' | 'eventos'; titulo: string; texto: string }) {
  const { carregando, membro, email } = useMembro();
  if (carregando) return <Carregando />;
  if (!membro || !podeVer(membro, papel)) return <SemAcesso email={email} />;
  return (
    <Tela membro={membro}>
      <Destaque rotulo="Em breve" titulo={titulo} descricao={texto} cor={PERFIS.find((p) => p.papel === papel)?.cor} />
      <div className="miolo">
        <Ferramentas>
          <BotaoPlanilha<Empresa | Evento> preparar={() => preparar(papel) as Promise<Exportacao<Empresa | Evento>>} />
        </Ferramentas>
      </div>
    </Tela>
  );
}
