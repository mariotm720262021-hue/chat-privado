import React, { useState } from "react";
import { X, Tv, Radio, Youtube, Film, Play, Sparkles, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { IPTVPlayer } from "./IPTVPlayer";
import { extractYouTubeId, detectMediaType } from "./MediaMessageBubble";

interface IPTVFloatingModalProps {
  onClose: () => void;
  initialUrl?: string;
}

export const IPTVFloatingModal: React.FC<IPTVFloatingModalProps> = ({ onClose, initialUrl = "" }) => {
  const [streamUrl, setStreamUrl] = useState<string>(initialUrl || "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
  const [activeUrl, setActiveUrl] = useState<string>(initialUrl || "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
  const [channelTitle, setChannelTitle] = useState<string>("Canal IPTV / Transmisión en Vivo");

  const sampleChannels = [
    {
      name: "Big Buck Bunny (HLS Live)",
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      type: "IPTV HLS",
    },
    {
      name: "Sintel Trailer (HLS)",
      url: "https://bitdash-a.akamaihd.net/content/sintel/hls/video/sintel.m3u8",
      type: "IPTV HLS",
    },
    {
      name: "Radio Clásica (Audio Stream MP3)",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      type: "Radio MP3",
    },
    {
      name: "NASA TV / Espacio (YouTube)",
      url: "https://www.youtube.com/watch?v=21X5lGlDOfg",
      type: "YouTube Live",
    },
  ];

  const handlePlayStream = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = streamUrl.trim();
    if (clean) {
      setActiveUrl(clean);
      setChannelTitle(`Reproduciendo: ${clean.substring(0, 35)}...`);
    }
  };

  const selectSample = (sample: typeof sampleChannels[0]) => {
    setStreamUrl(sample.url);
    setActiveUrl(sample.url);
    setChannelTitle(sample.name);
  };

  const ytId = activeUrl ? extractYouTubeId(activeUrl) : null;
  const isYouTube = !!ytId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Reproductor IPTV & Multimedia</h2>
              <p className="text-[11px] text-slate-400">Pega cualquier enlace IPTV (.m3u8), stream MP3 o video</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* Input de URL IPTV */}
          <form onSubmit={handlePlayStream} className="flex gap-2">
            <input
              type="url"
              placeholder="Pega URL del stream IPTV (.m3u8, .mp3, .mp4, youtube)..."
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-mono"
              required
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-950 shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Sintonizar</span>
            </button>
          </form>

          {/* Reproductor de Video / IPTV / YouTube */}
          {activeUrl && (
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
              {isYouTube && ytId ? (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`}
                    title="Reproductor YouTube"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <IPTVPlayer
                  src={activeUrl}
                  title={channelTitle}
                  isLive={activeUrl.includes(".m3u8") || activeUrl.includes("live") || activeUrl.includes("stream")}
                  autoPlay={true}
                />
              )}
            </div>
          )}

          {/* Canales de Ejemplo Rápidos */}
          <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Canales y Streams de Demostración:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sampleChannels.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSample(sample)}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-left transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{sample.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{sample.url}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                    {sample.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
