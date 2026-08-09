/**
 * app.js
 * Lógica principal de la aplicación de Chat Privado.
 * Maneja el estado global, navegación entre pantallas, compresión de imágenes,
 * formato de temporizadores de autodestrucción y sincronización con Firebase.
 */

import { 
  auth, 
  setupRecaptcha, 
  sendSMSCode, 
  verifySMSCode, 
  logoutUser,
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  setUserOnlineStatus,
  listenToUserProfile,
  searchUsers,
  getOrCreateChat,
  listenToUserChats,
  sendMessage,
  listenToMessages,
  deleteMessage,
  setTypingStatus
} from "./firebase.js";

/**
 * Comprime una imagen seleccionada por el usuario utilizando un canvas HTML5.
 * Retorna la imagen codificada en formato Data URL Base64 para almacenamiento ligero.
 */
export function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Formatea una fecha o Timestamp a formato de 12 horas "HH:MM AM/PM" (ej. "03:45 PM").
 */
export function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
  if (isNaN(date.getTime())) return "";
  
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

/**
 * Calcula el tiempo restante antes de que un mensaje se autodestruya.
 * Retorna una cadena formateada tipo "45m 30s" o "Expirando...".
 */
export function getRemainingTTL(expiresAt) {
  if (!expiresAt) return "";
  const expiresTime = expiresAt.toMillis ? expiresAt.toMillis() : (expiresAt.seconds ? expiresAt.seconds * 1000 : new Date(expiresAt).getTime());
  const now = Date.now();
  const diffMs = expiresTime - now;
  
  if (diffMs <= 0) return "Expirado";
  
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Genera un avatar predeterminado SVG con las iniciales del usuario.
 */
export function generateInitialsAvatar(name = "U") {
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4"];
  const colorIndex = (initial.charCodeAt(0) || 0) % colors.length;
  const bgColor = colors[colorIndex];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${bgColor}"/>
    <text x="50" y="55" font-family="sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Cuentas de prueba preconfiguradas para pruebas rápidas en el entorno iframe/sandbox.
 */
export const DEMO_USERS = [
  {
    uid: "demo_user_1",
    displayName: "Carlos Mendoza",
    email: "carlos@chatprivado.com",
    phoneNumber: "+52 555 123 4567",
    photoURL: generateInitialsAvatar("Carlos Mendoza")
  },
  {
    uid: "demo_user_2",
    displayName: "Ana Rodríguez",
    email: "ana@chatprivado.com",
    phoneNumber: "+52 555 987 6543",
    photoURL: generateInitialsAvatar("Ana Rodríguez")
  },
  {
    uid: "demo_user_3",
    displayName: "Sofía Gómez",
    email: "sofia@chatprivado.com",
    phoneNumber: "+34 600 112 233",
    photoURL: generateInitialsAvatar("Sofía Gómez")
  }
];
