import React, { useState } from "react";
import { X, Youtube, Film, Radio, Tv, Link2, Send, Play, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { detectMediaType } from "./MediaMessageBubble";

interface MediaUrlModalProps {
  onClose: () => void;
  onSendMedia: (url: string, type: "video" | "audio" | "youtube" | "iptv", comment?: string) => void;
}

export const MediaUrlModal: React.FC<MediaUrlModalProps> = ({ onClose, onSendMedia }) => {
  const [urlInput, setUrlInput] = useState<string>("");
  const [captionInput, setCaptionInput] = useState<string>("");
  const [selectedType, setSelectedType] = useState<"auto" | "youtube" | "video" | "audio" | "iptv">("auto");
  const [error, setError] = useState<string>("");

  const sampleUrls = [
    {
      title: "Stream IPTV / HLS (Demo)",
      type: "iptv" as const,
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      desc: "Canal de prueba HLS/IPTV en vivo",
    },
    {
      title: "Audio MP3 / Música",
      type: "audio" as const,
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      desc: "Música MP3 directa de alta calidad",
    },
    {
      title: "YouTube Video",
      type: "youtube" as const,
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      desc: "Video de YouTube con reproductor embebido",
    },
    {
      title: "Video MP4 Directo",
      type: "video" as const,
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      desc: "Video MP4 para reproducción directa",
    },
  ];

  const handleApplySample = (sample: typeof sampleUrls[0]) => {
    setUrlInput(sample.url);
    setSelectedType(sample.type);
    setCaptionInput(sample.title);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      setError("Por favor ingresa un enlace URL válido.");
      return;
    }

    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      setError("El enlace debe comenzar con https:// o http://");
      return;
    }

    let resolvedType: "video" | "audio" | "youtube" | "iptv" = "video";

    if (selectedType !== "auto") {
      resolvedType = selectedType;
    } else {
      const detected = detectMediaType(cleanUrl);
      if (detected === "youtube") resolvedType = "youtube";
      else if (detected === "iptv") resolvedType = "iptv";
      else if (detected === "audio") resolvedType = "audio";
      else resolvedType = "video";
    }

    onSendMedia(cleanUrl, resolvedType, captionInput.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Compartir Multimedia & IPTV</h2>
              <p className="text-[11px] text-slate-400">Pega enlaces de YouTube, MP3, Video o streams IPTV (.m3u8)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Selector de Tipo de Enlace */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Medio
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedType("youtube")}
                className={`p-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  selectedType === "youtube"
                    ? "bg-rose-600/20 border-rose-500 text-rose-300 shadow-sm"
                    : "bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white"
                }`}
              >
                <Youtube className="w-3.5 h-3.5 text-rose-500" />
                <span>YouTube</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType("iptv")}
                className={`p-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  selectedType === "iptv"
                    ? "bg-indigo-600/30 border-indigo-400 text-indigo-300 shadow-sm"
                    : "bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white"
                }`}
              >
                <Tv className="w-3.5 h-3.5 text-indigo-400" />
                <span>IPTV / M3U8</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType("audio")}
                className={`p-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  selectedType === "audio"
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm"
                    : "bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white"
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>MP3 / Radio</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType("video")}
                className={`p-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  selectedType === "video"
                    ? "bg-sky-600/20 border-sky-500 text-sky-300 shadow-sm"
                    : "bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white"
                }`}
              >
                <Film className="w-3.5 h-3.5 text-sky-400" />
                <span>Video MP4</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                URL del Contenido Multimedia
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="url"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-indigo-500 transition-colors font-mono"
                  required
                />
              </div>
            </div>

            {/* Mensaje / Comentario Opcional */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Título o Comentario (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Escucha este tema / Miren este canal en vivo"
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Ejemplos Rápidos */}
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400">
                <Sparkles className="w-3 h-3" />
                <span>Probar con Enlaces de Demostración:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sampleUrls.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplySample(sample)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-left transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {sample.type === "youtube" && <Youtube className="w-3 h-3 text-rose-500" />}
                      {sample.type === "iptv" && <Tv className="w-3 h-3 text-indigo-400" />}
                      {sample.type === "audio" && <Radio className="w-3 h-3 text-emerald-400" />}
                      {sample.type === "video" && <Film className="w-3 h-3 text-sky-400" />}
                      <span className="text-[11px] font-medium text-slate-200">{sample.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{sample.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-950"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar al Chat</span>
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
