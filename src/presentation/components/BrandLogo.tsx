import React, { useState } from 'react';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const CANDIDATOS_IMAGEM = ['./logo-basilico.png', './logo-basilico.jpg', '/logo-basilico.png', '/logo-basilico.jpg'];

const MAPA_TAMANHOS: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
  xl: 'w-32 h-32',
};

/**
 * Medalhão Oficial da Marca Restaurante Basílico.
 * Tenta carregar `/logo-basilico.png` ou `/logo-basilico.jpg` de `public/` e,
 * caso ausente, renderiza automaticamente o SVG vetorial fiel à identidade oficial:
 * fundo pergaminho (#F3E3C3 -> #DFC394), caligrafia "Basílico" (#23201E),
 * subtítulo "RESTAURANTE", arco dinâmico em Laranja Terracota (#E86F2C) e
 * duas folhas de manjericão vivas (#68A828 / #4E8C22).
 */
export function BrandLogo({ size = 'md', className = '' }: BrandLogoProps): React.ReactElement {
  const [indiceTentativa, setIndiceTentativa] = useState<number>(0);
  const [imagemCarregada, setImagemCarregada] = useState<boolean>(false);
  const [esgotouImagens, setEsgotouImagens] = useState<boolean>(false);

  const dimensaoClasse = MAPA_TAMANHOS[size];
  const srcAtual = CANDIDATOS_IMAGEM[indiceTentativa];

  const handleErroImagem = (): void => {
    if (indiceTentativa + 1 < CANDIDATOS_IMAGEM.length) {
      setIndiceTentativa((prev) => prev + 1);
    } else {
      setEsgotouImagens(true);
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full select-none shrink-0 p-[2px] bg-gradient-to-br from-[#E86F2C] via-[#D4A359] to-[#8C5828] shadow-md ${dimensaoClasse} ${className}`}
      title="Restaurante Basílico — Tradição Italiana"
    >
      <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-[#F3E3C3]">
        {/* Tenta carregar arquivo de imagem oficial caso o usuário coloque em public/ */}
        {!esgotouImagens && (
          <img
            src={srcAtual}
            alt="Logo Restaurante Basílico"
            onLoad={() => setImagemCarregada(true)}
            onError={handleErroImagem}
            className={`absolute inset-0 w-full h-full object-cover rounded-full transition-opacity duration-200 ${
              imagemCarregada ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
            }`}
          />
        )}

        {/* SVG Oficial do Restaurante Basílico (Fiel à Logo Real) */}
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          role="img"
          aria-label="Restaurante Basílico"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradiente Pergaminho Quente */}
            <radialGradient id="basilicoParchmentGrad" cx="45%" cy="38%" r="65%">
              <stop offset="0%" stopColor="#FAF0DA" />
              <stop offset="55%" stopColor="#F3E3C3" />
              <stop offset="100%" stopColor="#DFC394" />
            </radialGradient>

            {/* Gradiente Laranja Terracota do Arco */}
            <linearGradient id="basilicoTerracottaGrad" x1="0%" y1="0%" x2="100%" y2="20%">
              <stop offset="0%" stopColor="#D45D1B" />
              <stop offset="50%" stopColor="#E86F2C" />
              <stop offset="100%" stopColor="#F28B49" />
            </linearGradient>

            {/* Gradiente Folha de Manjericão Principal */}
            <linearGradient id="basilLeafGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3E7319" />
              <stop offset="55%" stopColor="#5CA329" />
              <stop offset="100%" stopColor="#7AC13A" />
            </linearGradient>

            {/* Gradiente Folha de Manjericão Secundária */}
            <linearGradient id="basilLeafGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#68A828" />
              <stop offset="100%" stopColor="#3A6B17" />
            </linearGradient>
          </defs>

          {/* Disco de Pergaminho */}
          <circle cx="100" cy="100" r="98" fill="url(#basilicoParchmentGrad)" />

          {/* Anel Interno Duplo Clássico */}
          <circle
            cx="100"
            cy="100"
            r="91"
            fill="none"
            stroke="#C9A875"
            strokeWidth="1.5"
            strokeOpacity="0.65"
          />
          <circle
            cx="100"
            cy="100"
            r="87"
            fill="none"
            stroke="#8C6B3F"
            strokeWidth="0.75"
            strokeDasharray="3 2"
            strokeOpacity="0.45"
          />

          {/* Duas Folhas de Manjericão Fresco no Canto Superior Direito */}
          <g transform="translate(116, 28)">
            {/* Folha Maior Inclinada à Direita */}
            <path
              d="M 12 36 C 8 18, 24 2, 46 4 C 46 24, 32 38, 12 36 Z"
              fill="url(#basilLeafGrad1)"
            />
            {/* Nervura Central da Folha Maior */}
            <path
              d="M 13 35 Q 27 21 43 6"
              fill="none"
              stroke="#C4EA96"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Folha Menor à Esquerda */}
            <path
              d="M 10 35 C -2 24, -1 7, 14 2 C 23 13, 21 26, 10 35 Z"
              fill="url(#basilLeafGrad2)"
            />
            {/* Nervura da Folha Menor */}
            <path
              d="M 10 34 Q 10 19 13 5"
              fill="none"
              stroke="#B5E282"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </g>

          {/* Tipografia Caligráfica "Basílico" em Carvão/Espresso Escuro */}
          <text
            x="100"
            y="108"
            textAnchor="middle"
            fill="#23201E"
            style={{
              fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
              fontWeight: 800,
              fontStyle: 'italic',
              fontSize: '42px',
              letterSpacing: '-0.5px',
            }}
          >
            Basílico
          </text>

          {/* Swoosh / Arco Dinâmico em Laranja Terracota sob o Nome */}
          <path
            d="M 28 122 Q 98 107 172 119 Q 104 121 36 129 Z"
            fill="url(#basilicoTerracottaGrad)"
          />
          <path
            d="M 48 128 Q 108 119 162 125"
            fill="none"
            stroke="#E86F2C"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.6"
          />

          {/* Subtítulo "RESTAURANTE" */}
          <text
            x="102"
            y="147"
            textAnchor="middle"
            fill="#23201E"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: '11.5px',
              letterSpacing: '4.5px',
            }}
          >
            RESTAURANTE
          </text>

          {/* Detalhe ornamental inferior (Tradição Italiana) */}
          <circle cx="100" cy="164" r="2.2" fill="#E86F2C" />
          <path d="M 74 164 L 92 164" stroke="#8C6B3F" strokeWidth="1" strokeOpacity="0.6" />
          <path d="M 108 164 L 126 164" stroke="#8C6B3F" strokeWidth="1" strokeOpacity="0.6" />
        </svg>
      </div>
    </div>
  );
}
