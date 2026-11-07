'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/cliente';
import { Exportacao, gerarPlanilha } from '@/lib/planilha';

/**
 * Botão "Gerar planilha" de cada setor. Monta o .xlsx no navegador, baixa e
 * registra no log quem gerou (a diretoria vê em Acessos).
 */
export default function BotaoPlanilha<T>({ preparar }: { preparar: () => Promise<Exportacao<T>> | Exportacao<T> }) {
  const [estado, setEstado] = useState<{ ocupado: boolean; msg: string; erro?: boolean }>({ ocupado: false, msg: '' });

  async function gerar() {
    setEstado({ ocupado: true, msg: 'Gerando…' });
    try {
      const exp = await preparar();
      const r = await gerarPlanilha(exp);
      await supabase().from('acessos').insert({ acao: `gerou_planilha_${exp.setor}` });
      setEstado({
        ocupado: false,
        msg: `${r.linhas} linha(s) · ${r.usouModelo ? 'modelo do CASD' : 'planilha padrão'}. Suba o arquivo na pasta do Drive.`,
      });
    } catch (e) {
      setEstado({ ocupado: false, msg: `Não deu para gerar: ${(e as Error).message}`, erro: true });
    }
  }

  return (
    <span className="botao-planilha">
      <button type="button" className="botao secundario" onClick={gerar} disabled={estado.ocupado}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M8 13h8 M8 17h8 M12 10v10" />
        </svg>
        {estado.ocupado ? 'Gerando…' : 'Gerar planilha'}
      </button>
      {estado.msg && !estado.ocupado && (
        <span className={`pequeno ${estado.erro ? 'texto-erro' : 'suave'}`} role="status">{estado.msg}</span>
      )}
    </span>
  );
}
