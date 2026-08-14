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

  // 1. EMBED DE YOUTUBE
  if (detectedType === "youtube" && ytId) {
    return (
      <div className="space-y-2">
        {content && content !== rawUrl && (
          <p className="whitespace-pre-wrap break-words text-xs">{content}</p>
        )}
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
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/75 rounded-md flex items-center gap-1.5 text-[10px] text-white font-medium">
                <Youtube className="w-3.5 h-3.5 text-rose-500" />
                <span>YouTube</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. EMBED DE IPTV / STREAMING (.M3U8 / HLS)
  if (detectedType === "iptv" && rawUrl) {
    return (
      <div className="space-y-2 max-w-sm sm:max-w-md w-full">
        {content && content !== rawUrl && (
          <p className="whitespace-pre-wrap break-words text-xs">{content}</p>
        )}
        <IPTVPlayer src={rawUrl} title="Canal / Transmisión IPTV" isLive={true} />
      </div>
    );
  }

  // 3. EMBED DE VIDEO DIRECTO (MP4 / WEBM)
  if (detectedType === "video" && rawUrl) {
    return (
      <div className="space-y-2 max-w-sm sm:max-w-md w-full">
        {content && content !== rawUrl && (
          <p className="whitespace-pre-wrap break-words text-xs">{content}</p>
        )}
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

  // 4. EMBED DE AUDIO / MP3 DIRECTO
  if (detectedType === "audio" && rawUrl) {
    return (
      <div className="space-y-2">
        {content && content !== rawUrl && (
          <p className="whitespace-pre-wrap break-words text-xs">{content}</p>
        )}
        <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 mb-1.5 font-medium">
            <Disc className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            <span>Audio / MP3</span>
          </div>
          <AudioPlayer src={rawUrl} isMe={isMe} />
        </div>
      </div>
    );
  }

  // 5. EMBED DE IMAGEN
  if ((type === "image" || detectedType === "image") && rawUrl) {
    return (
      <div className="space-y-2">
        <img
          src={rawUrl}
          alt="Adjunto"
          onClick={() => onImageClick && onImageClick(rawUrl)}
          className="w-full max-h-72 object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity border border-slate-800"
        />
        {content && content !== rawUrl && (
          <p className="whitespace-pre-wrap break-words text-xs">{content}</p>
        )}
      </div>
    );
  }

  // 6. TEXTO REGULAR CON PARSEO DE ENLACES
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline font-medium break-all inline-flex items-center gap-1 ${
              isMe ? "text-indigo-100 hover:text-white" : "text-indigo-400 hover:text-indigo-300"
            }`}
          >
            <span>{part}</span>
            <ExternalLink className="w-3 h-3 inline shrink-0" />
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
      {renderTextWithLinks(content)}
    </p>
  );
};
