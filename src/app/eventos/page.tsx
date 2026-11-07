'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import FichaEvento from '@/components/FichaEvento';
import LinhaDoTempo from '@/components/LinhaDoTempo';
import StatusDrive from '@/components/StatusDrive';
import Tela from '@/components/Tela';
import { Card, Destaque, Ferramentas, Fileira } from '@/components/Vitrine';
import { formatarReais } from '@/lib/contato';
import {
  corDoEvento, diasAte, Evento, fileirasPorCalendario, fileirasPorTipo, periodoCurto, proximoEvento, quando, rotuloSituacao, siglas, tipoDe, TIPOS,
} from '@/lib/eventos';
import { exportarEventos } from '@/lib/exportacoes';
import { ABAS_LEITURA_EVENTOS, eventosDeLinhas, novosPorNome } from '@/lib/importarPlanilha';
import { podeVer, useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';
import { hojeIso } from '@/lib/texto';

type Visao = 'calendario' | 'tipo';

export default function Eventos() {
  const { carregando, membro, email } = useMembro();
  const [dados, setDados] = useState<{ eventos: Evento[]; hoje: string } | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | 'novo' | null>(null);
  const [visao, setVisao] = useState<Visao>('calendario');
  const [versao, setVersao] = useState(0);

  const recarregar = useCallback(
    () =>
      supabase()
        .from('eventos')
        .select('*')
        .order('inicio', { ascending: true, nullsFirst: false })
        .then(({ data, error }) => {
          if (error) return setErro(error.message);
          const eventos = (data ?? []).map((e) => ({
            ...e,
            tipos: e.tipos ?? [],
            meta: e.meta === null ? null : Number(e.meta),
            arrecadado: e.arrecadado === null ? null : Number(e.arrecadado),
          })) as Evento[];
          setDados({ eventos, hoje: hojeIso() });
        }),
    [],
  );
  const salvou = useCallback(async () => {
    await recarregar();
    setVersao((v) => v + 1);
  }, [recarregar]);

  useEffect(() => {
    if (podeVer(membro, 'eventos')) recarregar();
  }, [membro, recarregar]);

  const fileiras = useMemo(
    () => (dados ? (visao === 'calendario' ? fileirasPorCalendario(dados.eventos, dados.hoje) : fileirasPorTipo(dados.eventos, dados.hoje)) : []),
    [dados, visao],
  );

  if (carregando) return <Carregando />;
  if (!membro || !podeVer(membro, 'eventos')) return <SemAcesso email={email} />;

  const eventos = dados?.eventos ?? [];
  const proximo = dados ? proximoEvento(eventos, dados.hoje) : null;
  const diasProximo = proximo && dados ? diasAte(proximo, dados.hoje) : null;
  const aberta = aberto && aberto !== 'novo' ? eventos.find((e) => e.id === aberto) ?? null : null;
  const contar = (t: string) => eventos.filter((e) => e.tipos.includes(t as Evento['tipos'][number]) && e.situacao !== 'cancelado').length;

  const card = (e: Evento) => {
    const d = dados ? diasAte(e, dados.hoje) : null;
    const grande = e.frequencia === 'unico' && d !== null && d >= 0 && d <= 90 && e.data_confirmada ? (d === 0 ? 'Hoje' : `${d} dias`) : periodoCurto(e);
    return (
      <Card
        key={e.id}
        titulo={e.nome}
        linha={[siglas(e), rotuloSituacao(e.situacao), e.meta ? `meta ${formatarReais(e.meta)}` : null].filter(Boolean).join(' · ')}
        grande={grande}
        selo={e.frequencia === 'unico' && e.inicio && !e.data_confirmada ? 'Data especulada' : e.tipos.map((t) => tipoDe(t).rotulo).join(' + ') || undefined}
        cor={corDoEvento(e)}
        aoAbrir={() => setAberto(e.id)}
      />
    );
  };

  return (
    <Tela membro={membro}>
      {proximo ? (
        <Destaque
          rotulo="Próximo evento"
          titulo={proximo.nome}
          cor={corDoEvento(proximo)}
          meta={[
            proximo.tipos.map((t) => `${tipoDe(t).sigla} · ${tipoDe(t).rotulo}`).join(' + '),
            quando(proximo),
            diasProximo !== null && diasProximo > 0 ? `faltam ${diasProximo} dias` : diasProximo === 0 ? 'é hoje' : null,
            rotuloSituacao(proximo.situacao),
          ]}
          descricao={proximo.descricao ?? `${eventos.length} eventos no calendário: ${TIPOS.map((t) => `${contar(t.valor)} ${t.sigla}`).join(', ')}.`}
          acoes={<button type="button" className="botao" onClick={() => setAberto(proximo.id)}>ⓘ Ver evento</button>}
        />
      ) : (
        <Destaque
          rotulo="Eventos"
          titulo={dados ? 'Calendário de eventos' : 'Carregando eventos…'}
          descricao={dados ? 'Cadastre os eventos planejados, mesmo com data ainda especulada.' : undefined}
        />
      )}

      <div className="miolo">
        <Ferramentas>
          <button type="button" className="botao destaque-cor" onClick={() => setAberto('novo')}>+ Novo evento</button>
          <StatusDrive
            planilha="eventos"
            pronto={!!dados}
            versao={versao}
            ehAdmin={membro.papel === 'admin'}
            preparar={() => exportarEventos(eventos, hojeIso())}
            importar={{
              abas: ABAS_LEITURA_EVENTOS,
              faltando: (lidas) => {
                const novos = novosPorNome(eventosDeLinhas(lidas['Eventos'] ?? []), (e) => e.nome, eventos.map((e) => e.nome));
                return {
                  nomes: novos.map((e) => e.nome),
                  gravar: async () => {
                    const { error } = await supabase().from('eventos').insert(novos);
                    if (error) throw new Error(error.message);
                    await salvou();
                  },
                };
              },
            }}
          />
          <div className="alternador" role="group" aria-label="Organizar fileiras por">
            <button type="button" aria-pressed={visao === 'calendario'} onClick={() => setVisao('calendario')}>Por calendário</button>
            <button type="button" aria-pressed={visao === 'tipo'} onClick={() => setVisao('tipo')}>Por tipo</button>
          </div>
        </Ferramentas>

        {erro && <p className="aviso erro">Erro ao carregar: {erro}</p>}

        {dados && eventos.length > 0 && <LinhaDoTempo eventos={eventos} hoje={dados.hoje} aoAbrir={setAberto} />}

        {fileiras.filter((f) => f.itens.length > 0).map((f) => (
          <Fileira key={f.chave} titulo={f.titulo} cor={f.cor} quantidade={f.itens.length}>
            {f.itens.map(card)}
          </Fileira>
        ))}
      </div>

      {aberto && dados && (
        <FichaEvento
          key={aberto}
          evento={aberta}
          podeApagar={membro.papel === 'admin'}
          aoFechar={() => setAberto(null)}
          aoSalvar={salvou}
        />
      )}
    </Tela>
  );
}
