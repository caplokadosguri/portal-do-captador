'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AbaDrive, chamarDrive, lerConfigDrive, pedidoDeEscrita, PlanilhaDrive } from '@/lib/drive/cliente';
import { Exportacao, gerarPlanilha } from '@/lib/planilha';
import type { Coluna } from '@/lib/planilha';
import { supabase } from '@/lib/supabase/cliente';

type Linhas = Record<string, Record<string, unknown>[]>;

export interface ImportacaoDrive {
  /** Abas lidas da planilha para conferir o que ainda não está no portal. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abas: { aba: string; colunas: Coluna<any>[] }[];
  /** Itens da planilha que não estão no portal (nome para mostrar e como gravar). */
  faltando: (lidas: Linhas) => { nomes: string[]; gravar: () => Promise<void> };
}

type Fase =
  | { tipo: 'carregando' }
  | { tipo: 'sem_config' }
  | { tipo: 'conferindo' }
  | { tipo: 'importar'; nomes: string[]; gravar: () => Promise<void>; confirmarApagar?: boolean }
  | { tipo: 'sincronizando' }
  | { tipo: 'ok' }
  | { tipo: 'erro'; msg: string };

const hora = (iso: string) => {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje ? `às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : `em ${d.toLocaleDateString('pt-BR')}`;
};

/**
 * Mostra se a planilha do setor no Drive está em dia e mantém ela em dia:
 * sincroniza ao abrir a tela (se fizer mais de 30 min) e depois de cada
 * alteração salva no portal (`versao` muda).
 */
export default function StatusDrive({
  planilha,
  preparar,
  pronto,
  versao,
  importar,
  ehAdmin,
}: {
  planilha: PlanilhaDrive;
  preparar: () => Promise<Exportacao> | Exportacao;
  pronto: boolean;
  versao: number;
  importar?: ImportacaoDrive;
  ehAdmin: boolean;
}) {
  const [fase, setFase] = useState<Fase>({ tipo: 'carregando' });
  const [url, setUrl] = useState<string | null>(null);
  const [ultima, setUltima] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const ponte = useRef<string | null>(null);
  const atual = useRef({ preparar, importar });
  useEffect(() => {
    atual.current = { preparar, importar };
  });

  const sincronizar = useCallback(async (manual = false) => {
    if (!ponte.current) return;
    setFase({ tipo: 'sincronizando' });
    try {
      const exp = await atual.current.preparar();
      const r = await chamarDrive(ponte.current, 'escrever', planilha, pedidoDeEscrita(exp));
      const gid = Array.isArray(r.abas) ? r.abas[0]?.gid : undefined;
      if (r.url) setUrl(gid !== undefined ? `${r.url.replace(/#.*$/, '')}#gid=${gid}` : r.url);
      setUltima(r.ultima ?? new Date().toISOString());
      setFase({ tipo: 'ok' });
      if (manual) await supabase().from('acessos').insert({ acao: `sincronizou_drive_${exp.setor}` });
    } catch (e) {
      setFase({ tipo: 'erro', msg: (e as Error).message });
    }
  }, [planilha]);

  // 1. Ao abrir: confere a ligação e o que já está na planilha.
  const conferido = useRef(false);
  useEffect(() => {
    if (!pronto || conferido.current) return;
    conferido.current = true;
    (async () => {
      try {
        const cfg = await lerConfigDrive();
        if (!cfg.url || !cfg.planilhas[planilha]) return setFase({ tipo: 'sem_config' });
        ponte.current = cfg.url;
        setFase({ tipo: 'conferindo' });
        const imp = atual.current.importar;
        const abas: AbaDrive[] = (imp?.abas ?? []).map((a) => ({
          aba: a.aba,
          colunas: a.colunas.map((c) => ({ titulo: c.titulo, outros: c.outrosNomes, tipo: c.tipo })),
        }));
        const r = await chamarDrive(cfg.url, 'ler', planilha, abas);
        setUrl(r.url ?? null);
        setUltima(r.ultima ?? null);
        if (imp && Array.isArray(r.abas)) {
          const lidas: Linhas = {};
          for (const a of r.abas) lidas[a.aba] = Array.isArray(a.linhas) ? a.linhas : [];
          const f = imp.faltando(lidas);
          if (f.nomes.length) return setFase({ tipo: 'importar', nomes: f.nomes, gravar: f.gravar });
        }
        const velha = !r.ultima || Date.now() - Date.parse(r.ultima) > 30 * 60 * 1000;
        if (velha) await sincronizar();
        else setFase({ tipo: 'ok' });
      } catch (e) {
        setFase({ tipo: 'erro', msg: (e as Error).message });
      }
    })();
  }, [pronto, planilha, sincronizar]);

  // 2. Depois de cada alteração salva no portal.
  //    Espera 2 s sem novas alterações (ex.: vários campos de uma subaba) e não
  //    começa outra escrita enquanto uma está em andamento: a pendência fica guardada.
  const versaoVista = useRef(versao);
  const pendente = useRef(false);
  useEffect(() => {
    if (versao !== versaoVista.current) {
      versaoVista.current = versao;
      pendente.current = true;
    }
    if (!pendente.current) return;
    if (ponte.current && fase.tipo !== 'importar' && fase.tipo !== 'sem_config' && fase.tipo !== 'sincronizando') {
      const t = setTimeout(() => {
        pendente.current = false;
        sincronizar();
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [versao, fase.tipo, sincronizar]);

  async function baixarXlsx() {
    setBaixando(true);
    try {
      await gerarPlanilha(await preparar());
    } finally {
      setBaixando(false);
    }
  }

  const abrir = url && (
    <a href={url} target="_blank" rel="noopener noreferrer">Abrir planilha ↗</a>
  );
  const copia = (
    <button type="button" className="link-botao" onClick={baixarXlsx} disabled={baixando}>
      {baixando ? 'Baixando…' : 'Baixar cópia (.xlsx)'}
    </button>
  );

  return (
    <div className={`status-drive ${fase.tipo}`} role="status" aria-live="polite">
      <span className="status-drive-icone" aria-hidden="true">
        {fase.tipo === 'ok' ? '✓' : fase.tipo === 'erro' || fase.tipo === 'importar' ? '!' : fase.tipo === 'sem_config' ? '○' : <span className="girando" />}
      </span>
      <span className="status-drive-texto">
        {fase.tipo === 'carregando' && <strong>Planilha no Drive</strong>}
        {fase.tipo === 'conferindo' && <strong>Conferindo a planilha no Drive…</strong>}
        {fase.tipo === 'sincronizando' && <strong>Atualizando a planilha no Drive…</strong>}
        {fase.tipo === 'ok' && (
          <>
            <strong>Planilha do Drive atualizada{ultima ? ` ${hora(ultima)}` : ''}</strong>
            <span className="acoes">
              {abrir}
              <button type="button" className="link-botao" onClick={() => sincronizar(true)}>Atualizar agora</button>
              {copia}
            </span>
          </>
        )}
        {fase.tipo === 'erro' && (
          <>
            <strong>Não deu para atualizar o Drive</strong>
            <span className="pequeno">{fase.msg}</span>
            <span className="acoes">
              <button type="button" className="link-botao" onClick={() => sincronizar(true)}>Tentar de novo</button>
              {abrir}
              {copia}
            </span>
          </>
        )}
        {fase.tipo === 'sem_config' && (
          <>
            <strong>A planilha do Drive ainda não foi ligada</strong>
            <span className="acoes">
              {ehAdmin ? <Link href="/admin/drive">Ligar agora</Link> : <span className="pequeno">Peça à diretoria para ligar em Início › Planilhas no Drive.</span>}
              {copia}
            </span>
          </>
        )}
        {fase.tipo === 'importar' && (
          <>
            <strong>
              A planilha tem {fase.nomes.length} {fase.nomes.length === 1 ? 'item que ainda não está' : 'itens que ainda não estão'} no portal
            </strong>
            <span className="pequeno">
              {fase.nomes.slice(0, 3).join('; ')}{fase.nomes.length > 3 ? '…' : ''}. Traga para o portal antes de atualizar o Drive, para não perder nada.
            </span>
            <span className="acoes">
              <button
                type="button"
                className="botao pequeno"
                onClick={async () => {
                  setFase({ tipo: 'sincronizando' });
                  try {
                    await fase.gravar();
                  } catch (e) {
                    setFase({ tipo: 'erro', msg: (e as Error).message });
                  }
                }}
              >
                Trazer para o portal
              </button>
              {fase.confirmarApagar ? (
                <button type="button" className="link-botao perigo" onClick={() => sincronizar(true)}>
                  Confirmar: apagar da planilha
                </button>
              ) : (
                <button type="button" className="link-botao" onClick={() => setFase({ ...fase, confirmarApagar: true })}>
                  Atualizar sem trazer
                </button>
              )}
              {abrir}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
