import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, Radio, Tv, AlertCircle, RefreshCw } from "lucide-react";

interface IPTVPlayerProps {
  src: string;
  title?: string;
  isLive?: boolean;
  autoPlay?: boolean;
  className?: string;
}

// Carga Hls.js de forma dinámica y bajo demanda desde CDN sin requerir bundling local
function loadHlsLibrary(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("Window no disponible"));
    }

    // Si ya está cargado globalmente en window
    if ((window as any).Hls) {
      return resolve((window as any).Hls);
    }

    const existingScript = document.getElementById("hls-script-loader");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve((window as any).Hls));
      existingScript.addEventListener("error", () => reject(new Error("Error al cargar script Hls")));
      return;
    }

    const script = document.createElement("script");
    script.id = "hls-script-loader";
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).Hls) {
        resolve((window as any).Hls);
      } else {
        reject(new Error("Hls no se inicializó correctamente"));
      }
    };
    script.onerror = () => {
      reject(new Error("No se pudo cargar la librería HLS desde CDN"));
    };
    document.head.appendChild(script);
  });
}

export const IPTVPlayer: React.FC<IPTVPlayerProps> = ({
  src,
  title,
  isLive = true,
  autoPlay = false,
  className = "",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const hlsInstanceRef = useRef<any>(null);

  const isAudioOnly = /\.(mp3|aac|ogg|wav)(\?|$)/i.test(src);
  const isHlsStream = /\.(m3u8)(\?|$)/i.test(src) || src.includes(".m3u8") || isLive;

  const destroyHls = () => {
    if (hlsInstanceRef.current) {
      try {
        hlsInstanceRef.current.destroy();
      } catch (e) {
        console.warn("Error destruyendo HLS:", e);
      }
      hlsInstanceRef.current = null;
    }
  };

  const initPlayer = async () => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setIsLoading(true);
    destroyHls();

    // 1. Si el navegador soporta HLS de forma nativa (como Safari en macOS / iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.onloadedmetadata = () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(() => setIsPlaying(false));
        }
      };
      video.onerror = () => {
        setError("Error al reproducir el flujo multimedia o canal IPTV.");
        setIsLoading(false);
      };
      return;
    }

    // 2. Si es flujo HLS (.m3u8) en navegadores como Chrome, Firefox, Edge
    if (isHlsStream) {
      try {
        const HlsClass = await loadHlsLibrary();
        if (HlsClass && HlsClass.isSupported()) {
          const hls = new HlsClass({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
          });

          hlsInstanceRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
            if (autoPlay) {
              video.play().catch(() => setIsPlaying(false));
            }
          });

          hls.on(HlsClass.Events.ERROR, (_event: any, data: any) => {
            if (data && data.fatal) {
              switch (data.type) {
                case HlsClass.ErrorTypes.NETWORK_ERROR:
                  setError("Error de red al sintonizar stream IPTV. Reintentando...");
                  hls.startLoad();
                  break;
                case HlsClass.ErrorTypes.MEDIA_ERROR:
                  setError("Recuperando error de códec o medio en el stream...");
                  hls.recoverMediaError();
                  break;
                default:
                  setError("No se pudo reproducir este stream IPTV/HLS.");
                  destroyHls();
                  break;
              }
            }
          });
          return;
        }
      } catch (err: any) {
        console.warn("Fallo cargando HLS dinámicamente:", err);
      }
    }

    // 3. Reproducción directa estándar para MP4 / WebM / MP3 directo
    video.src = src;
    video.onloadedmetadata = () => {
      setIsLoading(false);
      if (autoPlay) {
        video.play().catch(() => setIsPlaying(false));
      }
    };
    video.onerror = () => {
      setError("Error al reproducir el stream o archivo multimedia.");
      setIsLoading(false);
    };
  };

  useEffect(() => {
    initPlayer();

    return () => {
      destroyHls();
    };
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          console.error("Error reproduciendo:", e);
          setError("Haz clic para permitir la reproducción de audio/video.");
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const toggleFullScreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative group bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex flex-col ${className}`}
    >
      {/* Cabecera del reproductor */}
      <div className="p-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            {isAudioOnly ? <Radio className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">
              {title || (isAudioOnly ? "Transmisión de Audio / Radio" : "Canal IPTV / Streaming en Vivo")}
            </h4>
            <p className="text-[10px] text-slate-400 font-mono truncate">{src}</p>
          </div>
        </div>

        {/* Badge de EN VIVO */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
            {isLive ? "IPTV LIVE" : "MEDIA"}
          </span>
        </div>
      </div>

      {/* Área de Video / Visualizador de Audio */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className={`w-full h-full object-contain ${isAudioOnly ? "hidden" : "block"}`}
        />

        {/* Visualizador si es solo audio */}
        {isAudioOnly && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-rose-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-indigo-900/50 ${isPlaying ? "animate-pulse" : ""}`}>
              <Radio className="w-8 h-8" />
            </div>
            <p className="text-xs font-medium text-slate-200">Reproduciendo Flujo de Audio / MP3</p>
            <p className="text-[10px] text-indigo-400 mt-1 font-mono">Stream Activo</p>
          </div>
        )}

        {/* Overlay de Carga */}
        {isLoading && !error && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-slate-200 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs font-medium">Sintonizando señal IPTV...</span>
          </div>
        )}

        {/* Overlay de Error */}
        {error && (
          <div className="absolute inset-0 bg-slate-950/90 p-4 flex flex-col items-center justify-center text-center gap-2">
            <AlertCircle className="w-7 h-7 text-rose-400" />
            <p className="text-xs font-semibold text-rose-300">{error}</p>
            <button
              onClick={initPlayer}
              className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar Conexión</span>
            </button>
          </div>
        )}
      </div>

      {/* Barra de Controles */}
      <div className="p-2.5 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Botón Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={!!error}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-950 disabled:opacity-50"
            title={isPlaying ? "Pausar" : "Reproducir"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          {/* Botón Silenciar y Slider Volumen */}
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={toggleMute}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              title={isMuted ? "Activar Sonido" : "Silenciar"}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={initPlayer}
            className="p-1.5 text-slate-400 hover:text-indigo-300 rounded-lg transition-colors"
            title="Recargar transmisión"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {!isAudioOnly && (
            <button
              onClick={toggleFullScreen}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              title="Pantalla Completa"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
