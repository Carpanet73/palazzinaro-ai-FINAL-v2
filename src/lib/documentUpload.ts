/**
 * documentUpload.ts
 *
 * CORREZIONE BM — Utility condivisa: carica un file (Blob) su pCloud tramite la funzione
 * server /api/pcloud-upload, e restituisce un oggetto StoredDocument pronto da aggiungere
 * all'array `documents` di qualunque entità (Inquilino, Immobile, Contratto, Pratica
 * Legale) — stesso identico meccanismo ovunque nell'app, mai duplicato.
 */

import { StoredDocument } from "../types";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Carica un documento su pCloud e restituisce il riferimento da salvare nel database.
 * @param blob Il file da caricare (es. il PDF generato dallo scanner)
 * @param fileName Nome del file (con estensione)
 * @param category Etichetta leggibile, es. "Documento d'Identità", "Permesso di Soggiorno"
 * @param folderPath Sotto-cartella pCloud, es. "Inquilini/Song Zhen"
 */
export async function uploadDocumentToPCloud(
  blob: Blob,
  fileName: string,
  category: string,
  folderPath: string
): Promise<StoredDocument> {
  const base64 = await blobToBase64(blob);

  const response = await fetch("/api/pcloud-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      fileContentBase64: base64,
      folderPath
    })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Errore sconosciuto durante il caricamento su pCloud.");
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName,
    category,
    pcloudLink: data.publicLink || "",
    pcloudFileId: data.fileId,
    uploadedAt: new Date().toISOString()
  };
}
