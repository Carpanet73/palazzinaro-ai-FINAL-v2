/**
 * documentUpload.ts
 *
 * CORREZIONE BV — Utility condivisa: carica un file (Blob) su Firebase Storage e restituisce
 * un oggetto StoredDocument pronto da aggiungere all'array `documents` di qualunque entità
 * (Inquilino, Immobile, Contratto, Pratica Legale) — stesso identico meccanismo ovunque
 * nell'app, mai duplicato. Sostituisce il precedente meccanismo basato su pCloud (le cui
 * credenziali continuavano a essere rifiutate senza causa individuabile, nonostante fossero
 * verificate corrette con login diretto sul sito pCloud).
 *
 * Il caricamento avviene DIRETTAMENTE dal browser verso Firebase Storage (nessuna funzione
 * server in mezzo): usa la stessa autenticazione Firebase già in uso per il database, quindi
 * niente nuove credenziali da configurare e nessun problema di permessi tra siti diversi.
 */

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "../firebase";
import { StoredDocument } from "../types";

/**
 * Carica un documento su Firebase Storage e restituisce il riferimento da salvare nel database.
 * @param blob Il file da caricare (es. il PDF generato dallo scanner, o il .docx generato)
 * @param fileName Nome del file (con estensione)
 * @param category Etichetta leggibile, es. "Documento d'Identità", "Permesso di Soggiorno"
 * @param folderPath Sotto-cartella logica, es. "Inquilini/Song Zhen"
 */
export async function uploadDocumentToStorage(
  blob: Blob,
  fileName: string,
  category: string,
  folderPath: string
): Promise<StoredDocument> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Utente non autenticato: impossibile caricare il documento.");
  }

  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Percorso isolato per utente (stesso principio delle regole Firestore: userId == auth.uid)
  const storagePath = `users/${uid}/${folderPath}/${uniqueId}-${fileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    id: uniqueId,
    fileName,
    category,
    storageLink: downloadUrl,
    storagePath,
    uploadedAt: new Date().toISOString()
  };
}
