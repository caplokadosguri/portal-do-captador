'use client';

import { CSSProperties } from 'react';
import { EtapaFunil, ETAPAS_FUNIL } from '@/lib/parceiros';

// Funil básico: quatro faixas que afunilam, com a quantidade de empresas em cada etapa.
// Clicar numa faixa leva até a fileira daquela etapa.
export default function FunilParcerias({ contagem }: { contagem: Record<EtapaFunil, number> }) {
  const etapas = ETAPAS_FUNIL.filter((e) => e.valor !== 'fora');
  const fora = ETAPAS_FUNIL.find((e) => e.valor === 'fora')!;
  const ir = (e: EtapaFunil) => document.getElementById(`fileira-${e}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section className="funil" aria-label="Funil de parcerias">
      <ol>
        {etapas.map((e, i) => (
          <li key={e.valor} style={{ '--cor-etapa': e.cor, '--largura': `${100 - i * 14}%` } as CSSProperties}>
            <button type="button" onClick={() => ir(e.valor)} disabled={!contagem[e.valor]}>
              <span className="funil-nome">{e.rotulo}<small>{e.descricao}</small></span>
              <strong>{contagem[e.valor]}</strong>
            </button>
          </li>
        ))}
      </ol>
      {contagem.fora > 0 && (
        <button type="button" className="botao-link funil-fora" onClick={() => ir('fora')}>
          {fora.rotulo}: {contagem.fora} {contagem.fora === 1 ? 'empresa' : 'empresas'} (recusadas ou sem resposta)
        </button>
      )}
    </section>
  );
}
