import CloseIcon from "./CloseIcon";
import { createPortal } from "react-dom";

export default function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return createPortal(<div className="fixed inset-0 z-[2147483647] grid place-items-center bg-slate-950/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Pratinjau ${alt}`}>
    <button type="button" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-800 shadow-xl transition-colors hover:bg-red-50 hover:text-[#e62428]" onClick={onClose} aria-label="Tutup pratinjau gambar"><CloseIcon /></button>
    <button type="button" className="max-h-[90dvh] max-w-[min(960px,calc(100vw-2rem))] cursor-zoom-out" onClick={onClose} aria-label="Tutup gambar">
      <img src={src} alt={alt} className="max-h-[90dvh] max-w-full rounded-xl object-contain shadow-2xl" referrerPolicy="no-referrer" />
    </button>
  </div>, document.body);
}
