import React, { useState } from "react";
import { Youtube, Film, Radio, Tv, ExternalLink, Play, Disc } from "lucide-react";
import { IPTVPlayer } from "./IPTVPlayer";
import { AudioPlayer } from "./AudioPlayer";

interface MediaMessageBubbleProps {
  content: string;
  type?: "text" | "image" | "audio" | "video" | "youtube" | "iptv";
  mediaUrl?: string;
  isMe: boolean;
  onImageClick?: (url: string) => void;
}

// Extrae el ID de YouTube desde varios formatos de URL
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

// Determina el tipo de multimedia de una URL
export function detectMediaType(url: string): "youtube" | "video" | "audio" | "iptv" | "image" | null {
  if (!url) return null;
  const cleanUrl = url.trim();

  if (extractYouTubeId(cleanUrl)) return "youtube";
  if (/\.(m3u8)(\?|$)/i.test(cleanUrl) || cleanUrl.includes(".m3u8")) return "iptv";
  if (/\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(cleanUrl)) return "video";
  if (/\.(mp3|wav|ogg|aac|flac)(\?|$)/i.test(cleanUrl) || cleanUrl.includes("stream") || cleanUrl.includes("radio")) return "audio";
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(cleanUrl)) return "image";

  return null;
}

// Extrae URLs dentro de un texto
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches || [];
}

// Elimina cualquier URL o título técnico para que NUNCA se muestren direcciones web en pantalla
export function cleanCommentText(text: string): string {
  if (!text) return "";
  // Remover cualquier enlace http:// o https://
  let clean = text.replace(/https?:\/\/[^\s]+/gi, "").trim();
  // Remover títulos genéricos predeterminados si vinieran en el mensaje
  const genericTitles = [
    "YouTube Video",
    "Video MP4 Directo",
    "Stream IPTV / HLS (Demo)",
    "Audio MP3 / Música",
    "Canal IPTV",
    "Video Reproducible",
  ];
  if (genericTitles.includes(clean)) {
    return "";
  }
  return clean;
}

export const MediaMessageBubble: React.FC<MediaMessageBubbleProps> = ({
  content,
  type = "text",
  mediaUrl,
  isMe,
  onImageClick,
}) => {
  const [showIframe, setShowIframe] = useState<boolean>(false);

  // Buscar URLs en el contenido o usar mediaUrl
  const rawUrl = mediaUrl || (extractUrls(content).length > 0 ? extractUrls(content)[0] : "");
  const detectedType = type !== "text" ? type : (rawUrl ? detectMediaType(rawUrl) : null);
  const ytId = rawUrl ? extractYouTubeId(rawUrl) : null;

  // Comentario limpio del usuario (sin enlaces URL expuestos)
  const displayComment = cleanCommentText(content);

  // 1. EMBED DE YOUTUBE (Sin mostrar URLs)
  if (detectedType === "youtube" && ytId) {
    return (
      <div className="space-y-2">
        {displayComment ? (
          <p className="whitespace-pre-wrap break-words text-xs mb-1 font-medium">{displayComment}</p>
        ) : null}
        <div className="rounded-xl overflow-hidden border border-slate-700/80 bg-black aspect-video relative max-w-sm sm:max-w-md w-full shadow-lg">
          {showIframe ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`}
              title="Reproductor de YouTube"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          ) : (
            <div
              onClick={() => setShowIframe(true)}
              className="relative w-full h-full cursor-pointer group bg-slate-900 flex items-center justify-center"
            >
              <img
                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                alt="Miniatura de YouTube"
                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-rose-600 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-xl transition-transform group-hover:scale-110">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/75 rounded-md flex items-center gap-1.5 text-[10px] text-white font-medium backdrop-blur-sm">
                <Youtube className="w-3.5 h-3.5 text-rose-500" />
                <span>YouTube</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. EMBED DE IPTV / STREAMING (.M3U8 / HLS) (Sin mostrar URLs)
  if (detectedType === "iptv" && rawUrl) {
    return (
      <div className="space-y-2 max-w-sm sm:max-w-md w-full">
        {displayComment ? (
          <p className="whitespace-pre-wrap break-words text-xs mb-1 font-medium">{displayComment}</p>
        ) : null}
        <IPTVPlayer src={rawUrl} title="Canal / Transmisión IPTV" isLive={true} />
      </div>
    );
  }

  // 3. EMBED DE VIDEO DIRECTO (MP4 / WEBM) (Sin mostrar URLs)
  if (detectedType === "video" && rawUrl) {
    return (
      <div className="space-y-2 max-w-sm sm:max-w-md w-full">
        {displayComment ? (
          <p className="whitespace-pre-wrap break-words text-xs mb-1 font-medium">{displayComment}</p>
        ) : null}
        <div className="rounded-xl overflow-hidden border border-slate-700 bg-black shadow-md">
          <div className="p-2 bg-slate-900 border-b border-slate-800 flex items-center gap-1.5 text-[11px] text-indigo-300 font-medium">
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            <span className="truncate">Video Reproducible</span>
          </div>
          <video
            src={rawUrl}
            controls
            playsInline
            className="w-full max-h-72 object-contain bg-black"
          />
        </div>
      </div>
    );
  }

  // 4. EMBED DE AUDIO / MP3 DIRECTO (Sin mostrar URLs)
  if (detectedType === "audio" && rawUrl) {
    return (
      <div className="space-y-2">
        {displayComment ? (
          <p className="whitespace-pre-wrap break-words text-xs mb-1 font-medium">{displayComment}</p>
        ) : null}
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 mb-1.5 font-medium">
            <Disc className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            <span>Música / Audio MP3</span>
          </div>
          <AudioPlayer src={rawUrl} isMe={isMe} />
        </div>
      </div>
    );
  }

  // 5. IMAGEN
  if ((type === "image" || detectedType === "image") && (mediaUrl || rawUrl)) {
    const imgUrl = mediaUrl || rawUrl;
    return (
      <div className="space-y-2">
        {displayComment ? (
          <p className="whitespace-pre-wrap break-words text-xs mb-1 font-medium">{displayComment}</p>
        ) : null}
        <div
          onClick={() => onImageClick && onImageClick(imgUrl)}
          className="rounded-xl overflow-hidden cursor-pointer max-w-xs sm:max-w-sm border border-slate-700/60 shadow-md hover:opacity-95 transition-opacity"
        >
          <img
            src={imgUrl}
            alt="Adjunto"
            className="w-full h-auto max-h-80 object-cover bg-slate-950"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  // 6. MENSAJE DE TEXTO NORMAL (Sin formatos multimedia detectados)
  return (
    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{content}</p>
  );
};
