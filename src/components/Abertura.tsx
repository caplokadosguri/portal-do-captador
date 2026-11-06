'use client';

import { useEffect, useState } from 'react';
import { AVIAO, LETRA_C, LETRA_D, LETRA_S } from './logoPaths';
import './abertura.css';

export const DURACAO_ABERTURA_MS = 5300;

/** Abertura CASDflix: o avião voa em curvas, se aproxima até cobrir a tela e revela os perfis. */
export default function Abertura() {
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const ajustar = () => setEscala(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  return (
    <>
      <div className="ab-fundo" aria-hidden="true">
        <div className="ab-palco" style={{ transform: `translate(-50%, -50%) scale(${escala})` }}>
          <div className="ab-lockup">
            <svg viewBox="0 0 2810 650">
              <g className="ab-letras" fill="#3192B3" fillRule="evenodd">
                <path d={LETRA_C} />
                <path d={LETRA_S} />
                <path d={LETRA_D} />
              </g>
              <text
                className="ab-flix"
                x="1885"
                y="540"
                fill="#F9B341"
                style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 640, fontWeight: 400, letterSpacing: -8 }}
              >
                flix
              </text>
            </svg>
          </div>
          <div className="ab-aviao-entra">
            <div className="ab-aviao-voo">
              <svg viewBox="455 8 474 634">
                <path d={AVIAO} fill="#F9B341" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="ab-cobre" aria-hidden="true" />
    </>
  );
}
