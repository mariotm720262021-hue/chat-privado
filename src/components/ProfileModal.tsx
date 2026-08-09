import React, { useState, useRef } from "react";
import { X, Camera, User, Smile, Save, Check, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { SupabaseProfile, updateUserProfile, uploadAvatarToStorage } from "../supabase";
import { generateInitialsAvatar } from "../app";

interface ProfileModalProps {
  userProfile?: SupabaseProfile | null;
  onClose: () => void;
  onProfileUpdated: (updatedProfile: SupabaseProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  userProfile,
  onClose,
  onProfileUpdated,
}) => {
  const [displayName, setDisplayName] = useState(userProfile?.display_name || "");
  const [statusMessage, setStatusMessage] = useState(userProfile?.status_message || "");
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatar_url || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id) return;

    setError("");
    setLoading(true);
    setSuccess(false);

    try {
      let finalAvatarUrl = avatarUrl;

      // Si seleccionó un nuevo archivo de imagen de perfil
      if (selectedFile) {
        finalAvatarUrl = await uploadAvatarToStorage(selectedFile, userProfile.id);
      }

      const updated = await updateUserProfile(userProfile.id, {
        display_name: displayName.trim() || userProfile.username || "usuario",
        status_message: statusMessage.trim(),
        avatar_url: finalAvatarUrl,
      });

      if (updated) {
        setSuccess(true);
        onProfileUpdated(updated);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error("Error al actualizar perfil:", err);
      setError(err.message || "Error al guardar el perfil en Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const currentAvatar = previewUrl || avatarUrl || generateInitialsAvatar(displayName || "U");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative"
      >
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            Editar Perfil Personal
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>¡Perfil actualizado con éxito!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SECCIÓN AVATAR */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <img
                src={currentAvatar}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500/50 shadow-lg shadow-indigo-950/50"
              />
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Cambiar Foto de Perfil</span>
            </button>
          </div>

          {/* NOMBRE VISIBLE */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre Visible
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Ej. Carlos Mendoza"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          {/* ESTADO DE ÁNIMO / MENSAJE DE ESTADO */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Estado de Ánimo / Mensaje de Estado
            </label>
            <div className="relative">
              <Smile className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Ej. Hoy estoy alegre, Disponible, Ocupado..."
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
                maxLength={100}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Este mensaje aparecerá en los detalles de tu perfil y en la cabecera del chat.</p>
          </div>

          {/* NOMBRE DE USUARIO (SOLO LECTURA) */}
          <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Nombre de usuario único:</span>
            <p className="text-xs font-mono font-semibold text-indigo-400 mt-0.5">@{userProfile?.username || "usuario"}</p>
          </div>

          {/* BOTÓN GUARDAR */}
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
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-950"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando en Supabase...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
