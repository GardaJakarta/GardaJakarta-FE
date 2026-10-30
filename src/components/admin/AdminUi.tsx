import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check, X } from "@phosphor-icons/react";

import { field, quietButton } from "./admin-styles";

export function Modal({ title, children, onClose, busy = false, drawer = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }} className={drawer ? "fixed inset-0 m-0 h-dvh max-h-dvh w-[min(85vw,300px)] max-w-none overflow-y-auto border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40" : "fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-24px)] max-w-2xl overflow-y-auto rounded-xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40"}>
    <div className={drawer ? "flex min-h-dvh flex-col p-5" : "p-5 sm:p-6"}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id={titleId} className="font-heading text-lg font-bold">{title}</h2><button type="button" onClick={onClose} disabled={busy} className={quietButton} aria-label="Tutup panel"><X size={18} /></button></div>
      {children}
    </div>
  </dialog>;
}

export function AdminSelect({ id, label, value, options, onChange, disabled = false }: { id?: string; label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<HTMLElement>(document.body);
  const openMenu = () => { setRoot(trigger.current?.closest("dialog") || document.body); setOpen(true); };
  const [position, setPosition] = useState({ top: 0, left: 0, width: 200, maxHeight: 240 });
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const listId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
      const height = Math.min(240, Math.max(below, above), options.length * 40 + 12);
      const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 24);
      setPosition({ top: below >= height ? rect.bottom + 6 : Math.max(12, rect.top - height - 6), left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, maxHeight: height });
    };
    place();
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    menu.current?.querySelector<HTMLButtonElement>(`[aria-selected="true"]`)?.focus();
    if (!menu.current?.contains(document.activeElement)) menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, options.length]);
  // Keep the portal inside an open dialog so it shares the modal's top layer and focus scope.

  return <div className="min-w-0"><button id={id} ref={trigger} type="button" disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => { if (open) setOpen(false); else openMenu(); }} onKeyDown={(event) => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); openMenu(); } }} className={`${field} flex items-center justify-between gap-3 text-left`}><span className="truncate">{options.find((option) => option.value === value)?.label || "Pilih..."}</span><CaretDown size={15} className="shrink-0" /></button>
    {open && createPortal(<div id={listId} ref={menu} role="listbox" aria-label={label} style={position} className="fixed z-[150] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl" onKeyDown={(event) => {
      if (event.key === "Escape" || event.key === "Tab") { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); trigger.current?.focus(); } setOpen(false); }
      const buttons = Array.from(menu.current?.querySelectorAll("button") || []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
    }}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }} className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold ${value === option.value ? "bg-red-50 text-red-700" : "text-slate-700 hover:bg-slate-50"}`}><span className="break-words">{option.label}</span>{value === option.value && <Check size={15} className="shrink-0" />}</button>)}</div>, root)}
  </div>;
}
