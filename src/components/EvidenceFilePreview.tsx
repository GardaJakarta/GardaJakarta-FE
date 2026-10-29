import { useEffect, useMemo, useState } from "react";
import ImagePreview from "./ImagePreview";

export default function EvidenceFilePreview({ file, onRemove }: { file: File; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <div className="relative"><button type="button" aria-label={`Lihat ${file.name}`} onClick={() => setOpen(true)} className="block w-full cursor-zoom-in overflow-hidden rounded-lg"><img src={url || undefined} alt={file.name} className="h-20 w-full object-cover" /></button>{onRemove && <button type="button" onClick={onRemove} aria-label={`Hapus ${file.name}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-950/75 text-sm font-bold text-white shadow hover:bg-[#e62428]">&times;</button>}{open && <ImagePreview src={url} alt={file.name} onClose={() => setOpen(false)} />}</div>;
}
