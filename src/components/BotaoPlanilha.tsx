'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/cliente';
import { Exportacao, gerarPlanilha } from '@/lib/planilha';

export interface OpcaoPlanilha {
  rotulo: string;
  preparar: () => Promise<Exportacao> | Exportacao;
  /** Usa um modelo do CASD: dá para partir do arquivo atual do Drive. */
  temModelo?: boolean;
  /** Confere o arquivo do Drive antes de atualizar; devolve um motivo para não seguir. */
  verificar?: (arquivo: ArrayBuffer) => Promise<string | null>;
}

const ICONE = 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M8 13h8 M8 17h8 M12 10v10';

/**
 * Botões de planilha de cada setor. Monta o .xlsx no navegador, baixa e
 * registra no log quem gerou (a diretoria vê em Acessos).
 *
 * "Atualizar arquivo do Drive": a pessoa baixa a planilha do Drive como .xlsx,
 * escolhe aqui e recebe o mesmo arquivo com as abas do portal atualizadas;
 * o que o portal não controla (outras abas, meses anteriores) fica como estava.
 */
export default function BotaoPlanilha({ opcoes }: { opcoes: OpcaoPlanilha[] }) {
  const [estado, setEstado] = useState<{ ocupado: boolean; msg: string; erro?: boolean }>({ ocupado: false, msg: '' });
  const entrada = useRef<HTMLInputElement>(null);
  const [alvo, setAlvo] = useState<OpcaoPlanilha | null>(null);

  async function gerar(op: OpcaoPlanilha, atual?: File) {
    setEstado({ ocupado: true, msg: 'Gerando…' });
    try {
      const bytes = atual ? await atual.arrayBuffer() : undefined;
      if (bytes && op.verificar) {
        const motivo = await op.verificar(bytes.slice(0));
        if (motivo) return setEstado({ ocupado: false, msg: motivo, erro: true });
      }
      const exp = await op.preparar();
      const r = await gerarPlanilha(exp, bytes);
      await supabase().from('acessos').insert({ acao: `gerou_planilha_${exp.setor}${atual ? '_sobre_arquivo' : ''}` });
      const onde = r.arquivoAtual ? 'arquivo do Drive atualizado' : r.usouModelo ? 'modelo do CASD' : 'planilha padrão';
      setEstado({
        ocupado: false,
        msg: `${r.linhas} linha(s) em ${r.abas.map((a) => `“${a}”`).join(', ')} · ${onde}. ${
          r.arquivoAtual ? 'No Drive: Arquivo › Importar › Substituir planilha.' : 'Suba o arquivo na pasta do Drive.'
        }`,
      });
    } catch (e) {
      setEstado({ ocupado: false, msg: `Não deu para gerar: ${(e as Error).message}`, erro: true });
    }
  }

  const comModelo = opcoes.filter((o) => o.temModelo);

  return (
    <span className="botao-planilha">
      <span className="linha" style={{ gap: 8 }}>
        {opcoes.map((op) => (
          <button key={op.rotulo} type="button" className="botao secundario" onClick={() => gerar(op)} disabled={estado.ocupado}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONE} />
            </svg>
            {op.rotulo}
          </button>
        ))}
        {comModelo.map((op) => (
          <button
            key={`drive-${op.rotulo}`}
            type="button"
            className="botao secundario"
            disabled={estado.ocupado}
            title="Escolha a planilha baixada do Drive (.xlsx): o portal atualiza só as abas dele"
            onClick={() => {
              setAlvo(op);
              entrada.current?.click();
            }}
          >
            ⇪ {comModelo.length > 1 ? `${op.rotulo}: ` : ''}atualizar arquivo do Drive
          </button>
        ))}
      </span>
      <input
        ref={entrada}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f && alvo) gerar(alvo, f);
        }}
      />
      {estado.msg && (
        <span className={`pequeno ${estado.erro ? 'texto-erro' : 'suave'}`} role="status">{estado.msg}</span>
      )}
    </span>
  );
}
