import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize2, Radio, Tv, AlertCircle, RefreshCw } from "lucide-react";

interface IPTVPlayerProps {
  src: string;
  title?: string;
  isLive?: boolean;
  autoPlay?: boolean;
  className?: string;
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
  const [isHlsSupported, setIsHlsSupported] = useState<boolean>(true);
  const hlsRef = useRef<Hls | null>(null);

  const isAudioOnly = /\.(mp3|aac|ogg|wav)(\?|$)/i.test(src);
  const isHlsStream = /\.(m3u8)(\?|$)/i.test(src) || src.includes(".m3u8") || isLive;

  const initPlayer = () => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setIsLoading(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Comprobar soporte de HLS
    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(() => setIsPlaying(false));
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Error de red al cargar el stream IPTV. Reintentando...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Error de códec o medio en el stream. Recuperando...");
              hls.recoverMediaError();
              break;
            default:
              setError("No se pudo reproducir este stream IPTV/HLS.");
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl") || !isHlsStream) {
      // Soporte nativo de Safari/iOS o vídeo/audio directo MP4/MP3
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        if (autoPlay) {
          video.play().catch(() => setIsPlaying(false));
        }
      });

      video.addEventListener("error", () => {
        setError("Error al reproducir el flujo multimedia o IPTV.");
        setIsLoading(false);
      });
    } else {
      setIsHlsSupported(false);
      setError("Tu navegador no soporta reproducción HLS/IPTV directamente.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
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
