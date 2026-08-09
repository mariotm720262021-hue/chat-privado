/**
 * firebase.js
 * Configuración e integración modular de Firebase Authentication y Firestore Database.
 * Incluye gestión de usuarios, chats, presencia en línea, indicador de "escribiendo" y autodestrucción de mensajes.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  serverTimestamp, 
  getDocs,
  Timestamp
} from "firebase/firestore";

// Cargar configuración de Firebase
import config from "../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

// Inicializar la App de Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth y Firestore con la base de datos específica provisionada
export const auth = getAuth(app);
export const db = config.firestoreDatabaseId 
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

/**
 * Configura el reCAPTCHA invisible o visible para la autenticación por número de teléfono.
 * @param {string} containerId ID del elemento contenedor
 */
export function setupRecaptcha(containerId = "recaptcha-container") {
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.warn("reCAPTCHA clear warning:", e);
    }
  }
  
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    'size': 'invisible',
    'callback': (response) => {
      console.log("reCAPTCHA resuelto con éxito:", response);
    },
    'expired-callback': () => {
      console.warn("reCAPTCHA expiró, reiniciando...");
    }
  });
  
  return window.recaptchaVerifier;
}

/**
 * Envía el código SMS de verificación al número telefónico.
 * @param {string} phoneNumber Número en formato E.164 (ej. +521234567890)
 * @param {RecaptchaVerifier} verifier Instancia de RecaptchaVerifier
 */
export async function sendSMSCode(phoneNumber, verifier) {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return confirmationResult;
  } catch (error) {
    console.error("Error al enviar SMS:", error);
    throw error;
  }
}

/**
 * Confirma el código SMS introducido por el usuario.
 * @param {object} confirmationResult Resultado retornado por sendSMSCode
 * @param {string} code Código de 6 dígitos introducido
 */
export async function verifySMSCode(confirmationResult, code) {
  try {
    const result = await confirmationResult.confirm(code);
    return result.user;
  } catch (error) {
    console.error("Error al verificar código SMS:", error);
    throw error;
  }
}

/**
 * Registra un nuevo usuario con Correo Electrónico y Contraseña.
 */
export async function registerWithEmail(email, password, displayName = "") {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Crear el perfil del usuario en Firestore
    await createUserProfile(user.uid, {
      email: user.email,
      displayName: displayName || user.email.split("@")[0],
      photoURL: ""
    });
    
    return user;
  } catch (error) {
    console.error("Error al registrar con correo:", error);
    throw error;
  }
}

/**
 * Inicia sesión con Correo Electrónico y Contraseña.
 */
export async function loginWithEmail(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Asegurar que exista perfil en Firestore
    const profile = await getUserProfile(user.uid);
    if (!profile) {
      await createUserProfile(user.uid, {
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0],
        photoURL: ""
      });
    } else {
      await setUserOnlineStatus(user.uid, true);
    }
    
    return user;
  } catch (error) {
    console.error("Error al iniciar sesión con correo:", error);
    throw error;
  }
}

/**
 * Inicia sesión anónima en Firebase Auth si no hay un usuario activo.
 */
export async function ensureAnonymousAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn("Error en autenticación anónima:", err);
    }
  }
  return auth.currentUser;
}

/**
 * Cierra la sesión activa.
 */
export async function logoutUser() {
  if (auth.currentUser) {
    await setUserOnlineStatus(auth.currentUser.uid, false);
  }
  return signOut(auth);
}

/**
 * Crea o actualiza el perfil del usuario en la colección 'users'.
 */
export async function createUserProfile(uid, data) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    const newUser = {
      uid,
      email: data.email || "",
      phoneNumber: data.phoneNumber || "",
      displayName: data.displayName || "Usuario",
      photoURL: data.photoURL || "",
      isOnline: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, newUser);
    return newUser;
  } else {
    // Preservar datos existentes y actualizar estado
    await updateDoc(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(data.email ? { email: data.email } : {}),
      ...(data.displayName ? { displayName: data.displayName } : {}),
      ...(data.photoURL ? { photoURL: data.photoURL } : {})
    });
    return snap.data();
  }
}

/**
 * Obtiene el perfil de un usuario por su UID.
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

/**
 * Actualiza la información del perfil del usuario (nombre, foto).
 */
export async function updateUserProfile(uid, data) {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

/**
 * Actualiza el estado en línea / desconectado del usuario.
 */
export async function setUserOnlineStatus(uid, isOnline) {
  if (!uid) return;
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      isOnline: isOnline,
      lastSeen: serverTimestamp()
    });
  } catch (err) {
    console.warn("Error actualizando estado online:", err);
  }
}

/**
 * Escucha cambios en el perfil de un usuario en tiempo real.
 */
export function listenToUserProfile(uid, callback) {
  if (!uid) return () => {};
  const userRef = doc(db, "users", uid);
  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    }
  });
}

/**
 * Busca usuarios por correo electrónico, número telefónico o nombre para iniciar un chat.
 */
export async function searchUsers(searchTerm, currentUid) {
  if (!searchTerm.trim()) return [];
  const usersRef = collection(db, "users");
  const snap = await getDocs(usersRef);
  const results = [];
  
  const termLower = searchTerm.toLowerCase();
  
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.uid !== currentUid) {
      const matchEmail = data.email && data.email.toLowerCase().includes(termLower);
      const matchPhone = data.phoneNumber && data.phoneNumber.includes(searchTerm);
      const matchName = data.displayName && data.displayName.toLowerCase().includes(termLower);
      if (matchEmail || matchPhone || matchName) {
        results.push(data);
      }
    }
  });
  
  return results;
}

/**
 * Obtiene o crea un chat privado entre el usuario actual y el destinatario.
 */
export async function getOrCreateChat(currentUid, targetUid, currentUserData, targetUserData) {
  const chatsRef = collection(db, "chats");
  
  // Buscar si ya existe un chat entre estos dos participantes
  const q = query(chatsRef, where("participants", "array-contains", currentUid));
  const querySnap = await getDocs(q);
  
  let existingChat = null;
  querySnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.participants && data.participants.includes(targetUid)) {
      existingChat = { id: docSnap.id, ...data };
    }
  });
  
  if (existingChat) {
    return existingChat;
  }
  
  // Si no existe, crear uno nuevo
  const newChatData = {
    participants: [currentUid, targetUid],
    participantNames: {
      [currentUid]: currentUserData.displayName || "Usuario",
      [targetUid]: targetUserData.displayName || "Contacto"
    },
    participantPhotos: {
      [currentUid]: currentUserData.photoURL || "",
      [targetUid]: targetUserData.photoURL || ""
    },
    lastMessageText: "",
    lastMessageTimestamp: serverTimestamp(),
    typing: {
      [currentUid]: false,
      [targetUid]: false
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const docRef = await addDoc(chatsRef, newChatData);
  return { id: docRef.id, ...newChatData };
}

/**
 * Escucha la lista de chats del usuario en tiempo real.
 */
export function listenToUserChats(currentUid, callback) {
  if (!currentUid) return () => {};
  const chatsRef = collection(db, "chats");
  const q = query(chatsRef, where("participants", "array-contains", currentUid));
  
  return onSnapshot(q, (snapshot) => {
    const chats = [];
    snapshot.forEach((docSnap) => {
      chats.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Ordenar localmente por último mensaje
    chats.sort((a, b) => {
      const timeA = a.lastMessageTimestamp?.seconds || 0;
      const timeB = b.lastMessageTimestamp?.seconds || 0;
      return timeB - timeA;
    });
    callback(chats);
  });
}

/**
 * Envía un mensaje con tiempo de vida (TTL: 1, 2 o 5 horas).
 */
export async function sendMessage(chatId, senderId, text, imageUrl = "", ttlHours = 1) {
  if (!chatId || !senderId) return;
  if (!text.trim() && !imageUrl) return;
  
  const nowMs = Date.now();
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const expiresAtDate = new Date(nowMs + ttlMs);
  
  const messagesRef = collection(db, "chats", chatId, "messages");
  const messageData = {
    senderId,
    text: text.trim(),
    imageUrl,
    timestamp: serverTimestamp(),
    ttlHours: Number(ttlHours),
    expiresAt: Timestamp.fromDate(expiresAtDate)
  };
  
  const docRef = await addDoc(messagesRef, messageData);
  
  // Actualizar último mensaje del chat
  const chatRef = doc(db, "chats", chatId);
  await updateDoc(chatRef, {
    lastMessageText: imageUrl ? "📷 Imagen" : text.trim(),
    lastMessageTimestamp: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return docRef.id;
}

/**
 * Escucha los mensajes de un chat específico en tiempo real y ejecuta la autodestrucción.
 */
export function listenToMessages(chatId, callback) {
  if (!chatId) return () => {};
  
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));
  
  return onSnapshot(q, (snapshot) => {
    const messages = [];
    const now = Date.now();
    const toDelete = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const msgId = docSnap.id;
      
      // Verificar si el mensaje ha expirado
      let isExpired = false;
      if (data.expiresAt) {
        const expiresTime = data.expiresAt.toMillis ? data.expiresAt.toMillis() : data.expiresAt.seconds * 1000;
        if (now >= expiresTime) {
          isExpired = true;
          toDelete.push(msgId);
        }
      }
      
      if (!isExpired) {
        messages.push({ id: msgId, ...data });
      }
    });
    
    // Autodestruir mensajes expirados de Firestore en segundo plano
    if (toDelete.length > 0) {
      toDelete.forEach((msgId) => {
        deleteDoc(doc(db, "chats", chatId, "messages", msgId)).catch((err) => {
          console.warn("Error eliminando mensaje autodestruido:", err);
        });
      });
    }
    
    callback(messages);
  });
}

/**
 * Elimina manualmente un mensaje.
 */
export async function deleteMessage(chatId, messageId) {
  const msgRef = doc(db, "chats", chatId, "messages", messageId);
  await deleteDoc(msgRef);
}

/**
 * Actualiza el indicador "escribiendo..." en el chat.
 */
export async function setTypingStatus(chatId, uid, isTyping) {
  if (!chatId || !uid) return;
  try {
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      [`typing.${uid}`]: isTyping
    });
  } catch (err) {
    console.warn("Error actualizando estado typing:", err);
  }
}
