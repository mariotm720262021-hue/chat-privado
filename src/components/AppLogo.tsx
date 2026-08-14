import React from "react";
import appLogoImg from "../assets/images/app_logo_1786677627920.jpg";

interface AppLogoProps {
  className?: string;
  size?: number;
  useImage?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({ 
  className = "w-16 h-16", 
  size = 64,
  useImage = false
}) => {
  if (useImage && appLogoImg) {
    return (
      <img
        src={appLogoImg}
        alt="Chat Privado Logo"
        className={`${className} object-contain rounded-2xl shadow-lg shadow-emerald-500/20`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_10px_20px_rgba(16,185,129,0.35)]"
      >
        <defs>
          {/* Gradiente principal verde - esmeralda - cian */}
          <linearGradient id="bubbleGrad" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#a3e635" />
            <stop offset="35%" stopColor="#22c55e" />
            <stop offset="75%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          {/* Gradiente del cuerpo del candado */}
          <linearGradient id="lockBodyGrad" x1="60" y1="80" x2="140" y2="160" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Gradiente del arco plateado / blanco */}
          <linearGradient id="shackleGrad" x1="75" y1="40" x2="125" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>

          {/* Gradiente de los puntos */}
          <radialGradient id="dotGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bef264" />
            <stop offset="70%" stopColor="#86efac" />
            <stop offset="100%" stopColor="#15803d" />
          </radialGradient>

          {/* Filtro de sombra suave para 3D */}
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#047857" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Círculo / Burbuja exterior estilo chat */}
        <path
          d="M 160 95 C 160 48 122 18 80 18 C 38 18 18 52 18 96 C 18 128 36 156 64 168 L 42 192 C 40 194 42 198 46 197 L 82 182 C 126 182 160 148 160 95 Z"
          fill="none"
          stroke="url(#bubbleGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Arco lateral decorativo abierto (característico del diseño) */}
        <path
          d="M 172 65 C 182 78 186 94 186 112 C 186 142 168 168 140 182"
          fill="none"
          stroke="url(#bubbleGrad)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* CANDADO CENTRAL */}
        <g filter="url(#softGlow)">
          {/* Arco del candado (Shackle plateado) */}
          <path
            d="M 76 96 V 70 C 76 56 86 46 100 46 C 114 46 124 56 124 70 V 96"
            fill="none"
            stroke="url(#shackleGrad)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Cuerpo del candado (Burbuja interior verde con puntas redondeadas) */}
          <rect
            x="60"
            y="84"
            width="80"
            height="56"
            rx="20"
            fill="url(#lockBodyGrad)"
          />

          {/* Cola de bocadillo en el cuerpo del candado */}
          <path
            d="M 74 136 L 70 152 C 69 155 72 157 75 155 L 90 140 Z"
            fill="url(#lockBodyGrad)"
          />

          {/* 3 Puntos de mensaje horizontales */}
          <circle cx="78" cy="112" r="7" fill="url(#dotGrad)" stroke="#166534" strokeWidth="1.5" />
          <circle cx="100" cy="112" r="7" fill="url(#dotGrad)" stroke="#166534" strokeWidth="1.5" />
          <circle cx="122" cy="112" r="7" fill="url(#dotGrad)" stroke="#166534" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
};
export default AppLogo;
