import EvidenceFilePreview from "./EvidenceFilePreview";

type EvidenceUploadFieldProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
};

const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

export default function EvidenceUploadField({ files, onChange, disabled = false, label = "Foto pendukung (opsional)", hint = "JPG, PNG, WebP. Maksimal 3 foto, 5 MB per foto." }: EvidenceUploadFieldProps) {
  const chooseFiles = (selected: File[]) => {
    if (disabled) return;
    if (selected.length > 3 || selected.some((file) => !acceptedTypes.includes(file.type) || file.size > 5 * 1024 * 1024)) return;
    onChange(selected);
  };

  return <div className="grid gap-2 text-xs font-semibold">
    <span>{label}</span>
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); chooseFiles(Array.from(event.dataTransfer.files)); }}
      className="grid cursor-pointer gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center transition hover:border-[#e62428] hover:bg-red-50"
    >
      <span className="mx-auto grid h-9 w-9 place-items-center text-slate-600">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-4-4L7 20" /></svg>
      </span>
      <span className="font-bold text-slate-600">Tarik foto ke sini atau pilih file</span>
      <span className="font-normal text-slate-500">{hint}</span>
      <input disabled={disabled} type="file" accept={acceptedTypes.join(",")} multiple className="sr-only" onChange={(event) => { chooseFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    </label>
    {files.length > 0 && <div className="grid grid-cols-3 gap-2">{files.map((file, index) => <EvidenceFilePreview key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))} />)}</div>}
  </div>;
}
