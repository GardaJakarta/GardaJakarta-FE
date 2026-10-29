import { useEffect, useMemo, useState } from "react";
import ImagePreview from "./ImagePreview";

export default function EvidenceFilePreview({ file }: { file: File }) {
  const [open, setOpen] = useState(false);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <><button type="button" aria-label={`Lihat ${file.name}`} onClick={() => setOpen(true)} className="cursor-zoom-in overflow-hidden rounded-lg"><img src={url || undefined} alt={file.name} className="h-20 w-full object-cover" /></button>{open && <ImagePreview src={url} alt={file.name} onClose={() => setOpen(false)} />}</>;
}
