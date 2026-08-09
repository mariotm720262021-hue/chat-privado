import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, Mic } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  isMe?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, isMe = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error("Error reproduciendo audio:", err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatSeconds = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex flex-col gap-1.5 p-2.5 rounded-xl min-w-[220px] max-w-[280px] ${
      isMe ? "bg-indigo-700/80 text-white" : "bg-slate-800/90 text-slate-100 border border-slate-700/60"
    }`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-3">
        {/* Botón Play / Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md ${
            isMe 
              ? "bg-white text-indigo-700 hover:bg-slate-100" 
              : "bg-indigo-600 text-white hover:bg-indigo-500"
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Info y Barra de Progreso */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between text-[11px] font-mono opacity-90">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3 text-emerald-400" />
              <span>Nota de voz</span>
            </span>
            <span>{formatSeconds(isPlaying ? currentTime : (duration || currentTime))}</span>
          </div>

          {/* ONDA / BARRA DESLIZANTE */}
          <div className="relative w-full h-2 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-900/40 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
