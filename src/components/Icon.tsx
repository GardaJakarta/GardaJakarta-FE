type IconName = "refresh" | "arrow-left" | "wifi-off" | "compass" | "pin" | "send";

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths = {
    refresh: <><path d="M20 11a8 8 0 1 1-2.34-5.66" /><path d="M20 4v7h-7" /></>,
    "arrow-left": <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
    "wifi-off": <><path d="M1 1l22 22" /><path d="M16.72 11.06A10.94 10.94 0 0 1 22 16.55" /><path d="M5 5.55A16 16 0 0 1 12 4c2.14 0 4.18.42 6.05 1.18" /><path d="M8.53 8.53A10.94 10.94 0 0 0 2 16.55" /><path d="M12 20h.01" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  }[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
}
