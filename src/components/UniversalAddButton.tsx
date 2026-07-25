
/**
 * UniversalAddButton — bottone flottante globale
 *
 * Sempre visibile (FAB - Floating Action Button), apre il MasterDataWizard da qualsiasi
 * sezione. CORREZIONE AS — ora è anche TRASCINABILE: se copre qualcosa (es. un campo di un
 * modulo da compilare), l'utente può spostarlo tenendolo premuto e trascinandolo altrove,
 * con mouse o con il dito da cellulare/tablet. La posizione resta ricordata tra una sessione
 * e l'altra.
 */

import React, { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

interface UniversalAddButtonProps {
  onClick: () => void;
  label?: string;
}

const STORAGE_KEY = "palazzinaro-fab-position";
const DRAG_THRESHOLD = 6; // px di movimento minimo prima di considerarlo un trascinamento, non un click

export default function UniversalAddButton({
  onClick,
  label = "Aggiungi",
}: UniversalAddButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragInfo = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean } | null>(null);

  // Carica l'ultima posizione salvata, se esiste
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPosition(parsed);
        }
      }
    } catch {
      // ignora dati salvati corrotti
    }
  }, []);

  const clampToViewport = (x: number, y: number) => {
    const btn = buttonRef.current;
    const w = btn?.offsetWidth || 160;
    const h = btn?.offsetHeight || 48;
    const maxX = window.innerWidth - w - 8;
    const maxY = window.innerHeight - h - 8;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, maxX)),
      y: Math.min(Math.max(8, y), Math.max(8, maxY)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      dragging: false,
    };
    btn.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const info = dragInfo.current;
    if (!info) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (!info.dragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      info.dragging = true;
    }
    if (info.dragging) {
      const next = clampToViewport(info.origX + dx, info.origY + dy);
      setPosition(next);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const info = dragInfo.current;
    const btn = buttonRef.current;
    if (btn && btn.hasPointerCapture(e.pointerId)) {
      btn.releasePointerCapture(e.pointerId);
    }
    if (info?.dragging) {
      // È stato trascinato: salva la nuova posizione e NON considerarlo un click
      setPosition(current => {
        if (current) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          } catch {
            // spazio localStorage non disponibile: nessun problema, resta solo per la sessione
          }
        }
        return current;
      });
    } else {
      // Non è stato trascinato: era un vero click
      onClick();
    }
    dragInfo.current = null;
  };

  const style: React.CSSProperties = position
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : {};

  return (
    <button
      ref={buttonRef}
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={style}
      className={`fixed ${position ? "" : "bottom-6 right-6"} z-40 group flex items-center gap-2 pl-4 pr-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-xl hover:shadow-2xl transition-shadow duration-200 active:scale-95 touch-none cursor-grab active:cursor-grabbing select-none`}
      title="Aggiungi nuovo immobile / inquilino / contratto — tienilo premuto e trascina per spostarlo"
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
        <Plus size={14} strokeWidth={3} />
      </div>
      <span className="text-[13px] font-semibold tracking-wide">{label}</span>
    </button>
  );
}
