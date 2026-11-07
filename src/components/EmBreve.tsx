'use client';

import BotaoPlanilha from '@/components/BotaoPlanilha';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import Tela from '@/components/Tela';
import { Destaque, Ferramentas } from '@/components/Vitrine';
import { Evento, exportarEventos } from '@/lib/exportacoes';
import { PERFIS, podeVer, useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';

async function prepararEventos() {
  const { data, error } = await supabase().from('eventos').select('*').order('data');
  if (error) throw new Error(error.message);
  return exportarEventos((data ?? []) as Evento[]);
}

/** Área ainda não construída (já com o botão de planilha). */
export default function EmBreve({ papel, titulo, texto }: { papel: 'eventos'; titulo: string; texto: string }) {
  const { carregando, membro, email } = useMembro();
  if (carregando) return <Carregando />;
  if (!membro || !podeVer(membro, papel)) return <SemAcesso email={email} />;
  return (
    <Tela membro={membro}>
      <Destaque rotulo="Em breve" titulo={titulo} descricao={texto} cor={PERFIS.find((p) => p.papel === papel)?.cor} />
      <div className="miolo">
        <Ferramentas>
          <BotaoPlanilha opcoes={[{ rotulo: 'Gerar planilha', preparar: prepararEventos }]} />
        </Ferramentas>
      </div>
    </Tela>
  );
}
