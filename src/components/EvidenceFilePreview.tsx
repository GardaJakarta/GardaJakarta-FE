import { useEffect, useMemo, useState } from "react";
import ImagePreview from "./ImagePreview";

export default function EvidenceFilePreview({ file, onRemove }: { file: File; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <div className="relative"><button type="button" aria-label={`Lihat ${file.name}`} onClick={() => setOpen(true)} className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-slate-100 p-1"><img src={url || undefined} alt={file.name} className="h-20 w-full rounded-md object-contain" /></button>{onRemove && <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} aria-label={`Hapus ${file.name}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/85 p-0 text-base font-bold leading-none text-white shadow hover:bg-[#e62428]">&times;</button>}{open && <ImagePreview src={url} alt={file.name} onClose={() => setOpen(false)} />}</div>;
}
