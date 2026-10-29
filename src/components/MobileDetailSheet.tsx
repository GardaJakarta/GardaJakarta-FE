import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function MobileDetailSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const [height, setHeight] = useState(68);
  const drag = useRef<{ y: number; height: number; moved: boolean } | null>(null);
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    drag.current = { y: event.clientY, height, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  return createPortal(<>
    <button type="button" aria-label="Tutup detail peta" className="fixed inset-0 z-[65] bg-slate-950/35 backdrop-blur-[2px]" onClick={onClose} />
    <section aria-label="Detail peta" style={{ height: `${height}dvh` }} className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[86dvh] min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl">
      <button type="button" aria-label="Ubah tinggi panel" onPointerDown={start} onPointerMove={(event) => {
        if (!drag.current) return;
        const delta = drag.current.y - event.clientY;
        if (Math.abs(delta) > 4) drag.current.moved = true;
        setHeight(Math.max(34, Math.min(86, drag.current.height + delta / window.innerHeight * 100)));
      }} onPointerUp={() => { if (drag.current?.moved) { if (height < 42) onClose(); else setHeight(height > 77 ? 86 : 68); } else setHeight(height > 77 ? 68 : 86); drag.current = null; }} onPointerCancel={() => { drag.current = null; }} className="flex shrink-0 touch-none cursor-grab justify-center pb-3 pt-3 active:cursor-grabbing"><span className="h-1.5 w-12 rounded-full bg-slate-200" /></button>
      <div className="mobile-map-detail min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{children}</div>
    </section>
  </>, document.body);
}
