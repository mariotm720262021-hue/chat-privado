import React, { useState } from "react";
import { X, Share2, Copy, Check, QrCode, MessageCircle, Send } from "lucide-react";
import { motion } from "motion/react";

interface ShareGroupModalProps {
  groupName: string;
  inviteCode: string;
  onClose: () => void;
}

export const ShareGroupModal: React.FC<ShareGroupModalProps> = ({
  groupName,
  inviteCode,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Determinar URL de invitación
  const baseUrl = typeof window !== "undefined" 
    ? window.location.href.split('?')[0].split('#')[0] 
    : "";
  const inviteUrl = `${baseUrl}?group_invite=${inviteCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Únete a ${groupName} en Chat Privado`,
          text: `Te invito a unirte al grupo "${groupName}". Usa este enlace para entrar al instante o ingresa el código: ${inviteCode}`,
          url: inviteUrl,
        });
      } catch (err) {
        console.warn("Share cancelado:", err);
      }
    } else {
      handleCopyLink();
    }
  };

  const shareText = encodeURIComponent(
    `¡Hola! Te invito a unirte a nuestro grupo "${groupName}" en Chat Privado. Haz clic aquí para entrar: ${inviteUrl}\nO usa el código: ${inviteCode}`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative"
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Compartir Grupo por URL</h2>
              <p className="text-[11px] text-slate-400">{groupName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* CÓDIGO DE INVITACIÓN DESTACADO */}
          <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-xl text-center space-y-1.5 shadow-inner">
            <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 font-bold">
              Código de Invitación Único
            </span>
            <div className="text-2xl font-mono font-black text-white tracking-widest">
              {inviteCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 mt-1 underline"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">¡Código copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar solo código</span>
                </>
              )}
            </button>
          </div>

          {/* ENLACE DIRECTO */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Enlace de Invitación Directo (URL)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none font-mono select-all truncate"
              />
              <button
                onClick={handleCopyLink}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                  copiedLink
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950"
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Cualquier persona que abra este enlace se unirá automáticamente a la sala grupal.
            </p>
          </div>

          {/* BOTONES DE COMPARTIR DIRECTO */}
          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2.5">
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>WhatsApp</span>
            </a>

            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Únete al grupo ${groupName}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Telegram</span>
            </a>
          </div>

          <button
            onClick={handleNativeShare}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/80 flex items-center justify-center gap-2 transition-colors"
          >
            <Share2 className="w-4 h-4 text-indigo-400" />
            <span>Compartir con otras aplicaciones</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
