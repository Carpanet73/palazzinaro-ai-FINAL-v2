
/**
 * DocumentScanner — componente riutilizzabile "tipo scanner"
 *
 * CORREZIONE BL — costruito su richiesta esplicita per l'Area Contratti (documenti
 * d'identità, permessi di soggiorno, visure catastali, APE): fotografa o carica una o più
 * pagine, ognuna può essere ritagliata a mano (rettangolo con angoli trascinabili) e viene
 * migliorata automaticamente in leggibilità (più contrasto, tipo scanner), poi tutte le
 * pagine vengono raccolte in un unico PDF multipagina.
 *
 * Deliberatamente SENZA riconoscimento automatico dei bordi (perspective correction): solo
 * ritaglio manuale, come concordato — più affidabile, niente librerie pesanti di visione
 * artificiale.
 */

import React, { useState, useRef } from "react";
import { jsPDF } from "jspdf";
import { Camera, X, Plus, CheckCircle2, Loader2 } from "lucide-react";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DocumentScannerProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onComplete: (pdfBlob: Blob, pageCount: number) => void;
}

type DragHandle = "tl" | "tr" | "bl" | "br" | "move" | null;

export default function DocumentScanner({ isOpen, title, onClose, onComplete }: DocumentScannerProps) {
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [cropRect, setCropRect] = useState<CropRect>({ x: 20, y: 20, width: 260, height: 340 });
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, rect: { x: 0, y: 0, width: 0, height: 0 } });
  const [generating, setGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const DISPLAY_WIDTH = 320;

  if (!isOpen) return null;

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        const displayHeight = (img.naturalHeight / img.naturalWidth) * DISPLAY_WIDTH;
        setCropRect({
          x: DISPLAY_WIDTH * 0.06,
          y: displayHeight * 0.06,
          width: DISPLAY_WIDTH * 0.88,
          height: displayHeight * 0.88
        });
        setRawImage(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayHeight = imgNaturalSize.width > 0 ? (imgNaturalSize.height / imgNaturalSize.width) * DISPLAY_WIDTH : 0;

  const getPointerPos = (e: React.PointerEvent) => {
    const rect = imgContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (handle: DragHandle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pos = getPointerPos(e);
    setDragHandle(handle);
    setDragStart({ x: pos.x, y: pos.y, rect: { ...cropRect } });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragHandle) return;
    const pos = getPointerPos(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    const { x, y, width, height } = dragStart.rect;

    let next = { x, y, width, height };
    if (dragHandle === "move") {
      next = {
        ...next,
        x: Math.max(0, Math.min(DISPLAY_WIDTH - width, x + dx)),
        y: Math.max(0, Math.min(displayHeight - height, y + dy))
      };
    } else if (dragHandle === "tl") {
      next = { x: x + dx, y: y + dy, width: width - dx, height: height - dy };
    } else if (dragHandle === "tr") {
      next = { x, y: y + dy, width: width + dx, height: height - dy };
    } else if (dragHandle === "bl") {
      next = { x: x + dx, y, width: width - dx, height: height + dy };
    } else if (dragHandle === "br") {
      next = { x, y, width: width + dx, height: height + dy };
    }

    next.width = Math.max(40, Math.min(next.width, DISPLAY_WIDTH));
    next.height = Math.max(40, Math.min(next.height, displayHeight));
    next.x = Math.max(0, Math.min(next.x, DISPLAY_WIDTH - next.width));
    next.y = Math.max(0, Math.min(next.y, displayHeight - next.height));

    setCropRect(next);
  };

  const handlePointerUp = () => setDragHandle(null);

  const confirmCrop = () => {
    if (!imgRef.current) return;
    const scale = imgNaturalSize.width / DISPLAY_WIDTH;
    const canvas = document.createElement("canvas");
    canvas.width = cropRect.width * scale;
    canvas.height = cropRect.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      cropRect.x * scale, cropRect.y * scale, cropRect.width * scale, cropRect.height * scale,
      0, 0, canvas.width, canvas.height
    );

    // CORREZIONE BL — miglioramento leggibilità "tipo scanner": più contrasto e luminosità,
    // senza passare al bianco e nero puro (che perderebbe timbri/firme colorate importanti).
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const contrast = 1.35;
    const brightness = 12;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.max(0, Math.min(255, (data[i + c] - 128) * contrast + 128 + brightness));
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const enhancedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPages(prev => [...prev, enhancedDataUrl]);
    setRawImage(null);
  };

  const removePage = (index: number) => {
    setCapturedPages(prev => prev.filter((_, i) => i !== index));
  };

  const generatePdf = async () => {
    if (capturedPages.length === 0) return;
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      for (let i = 0; i < capturedPages.length; i++) {
        if (i > 0) doc.addPage();
        const pageDataUrl = capturedPages[i];
        const img = new window.Image();
        await new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.src = pageDataUrl;
        });
        const pageWidth = 210, pageHeight = 297;
        const margin = 10;
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (pageWidth - w) / 2;
        const y = (pageHeight - h) / 2;
        doc.addImage(pageDataUrl, "JPEG", x, y, w, h);
      }
      const blob = doc.output("blob");
      onComplete(blob, capturedPages.length);
      setCapturedPages([]);
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    setCapturedPages([]);
    setRawImage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <h3 className="font-sans font-bold text-sm flex items-center gap-1.5">
            <Camera size={15} className="text-white shrink-0" />
            {title}
          </h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {!rawImage ? (
            <>
              {capturedPages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {capturedPages.map((page, idx) => (
                    <div key={idx} className="relative group">
                      <img src={page} alt={`Pagina ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                      <span className="absolute top-1 left-1 bg-slate-900/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        Pag. {idx + 1}
                      </span>
                      <button
                        onClick={() => removePage(idx)}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              >
                <span className="w-[18px] h-[18px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  {capturedPages.length === 0 ? <Camera size={11} className="text-white" /> : <Plus size={11} className="text-white" />}
                </span>
                {capturedPages.length === 0 ? "Scatta / Carica Prima Pagina" : "Aggiungi un'Altra Pagina"}
              </button>

              {capturedPages.length > 0 && (
                <button
                  onClick={generatePdf}
                  disabled={generating}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <span className="w-[18px] h-[18px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    {generating ? <Loader2 size={11} className="text-white animate-spin" /> : <CheckCircle2 size={11} className="text-white" />}
                  </span>
                  {generating ? "Genero il PDF..." : `Genera PDF (${capturedPages.length} pagin${capturedPages.length === 1 ? "a" : "e"})`}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-500">Trascina gli angoli per ritagliare solo il documento, poi conferma.</p>
              <div
                ref={imgContainerRef}
                className="relative mx-auto select-none touch-none"
                style={{ width: DISPLAY_WIDTH, height: displayHeight }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <img
                  ref={imgRef}
                  src={rawImage}
                  alt="Da ritagliare"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/50 pointer-events-none" style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${cropRect.y}px, ${cropRect.x}px ${cropRect.y}px, ${cropRect.x}px ${cropRect.y + cropRect.height}px, ${cropRect.x + cropRect.width}px ${cropRect.y + cropRect.height}px, ${cropRect.x + cropRect.width}px ${cropRect.y}px, 0 ${cropRect.y}px)`
                }} />
                <div
                  onPointerDown={handlePointerDown("move")}
                  className="absolute border-2 border-amber-400 cursor-move"
                  style={{ left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height }}
                />
                {(["tl", "tr", "bl", "br"] as const).map(corner => (
                  <div
                    key={corner}
                    onPointerDown={handlePointerDown(corner)}
                    className="absolute w-5 h-5 bg-amber-400 border-2 border-white rounded-full shadow-md cursor-pointer touch-none"
                    style={{
                      left: (corner === "tl" || corner === "bl" ? cropRect.x : cropRect.x + cropRect.width) - 10,
                      top: (corner === "tl" || corner === "tr" ? cropRect.y : cropRect.y + cropRect.height) - 10
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRawImage(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmCrop}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <span className="w-[14px] h-[14px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={9} className="text-white" />
                  </span>
                  Conferma Ritaglio
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
