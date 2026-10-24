# Garda Jakarta FE

Frontend application Garda Jakarta untuk autentikasi pengguna dan fondasi peta informasi keamanan.

## Scope awal

- React + Vite + TypeScript.
- Route `/login` dan `/register` dengan validasi form dasar.
- Session token disimpan di `localStorage` untuk starter flow.
- Route `/map` sebagai placeholder terproteksi setelah login.
- Proxy Vite dari `/api` ke backend lokal `http://localhost:4000`.
- Layout auth mengikuti referensi pola login/register Mobbin: hierarchy tegas, form ringkas, dan feedback error langsung.
- Ilustrasi auth menggunakan artwork unDraw yang dibundel di `public/illustrations`.

## Menjalankan

```bash
npm install
copy .env.example .env
npm run dev
```

Buka `http://localhost:5173`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

Backend diharapkan berjalan pada `http://localhost:4000`. Atur `VITE_API_URL` jika endpoint API berada di alamat lain.

Untuk menjalankan hasil build seperti di Railway:

```bash
npm run build
npm start
```

## Struktur

| Path | Fungsi |
| --- | --- |
| `src/pages` | Halaman login, register, dan placeholder map |
| `src/components` | Shell dan form autentikasi reusable |
| `src/context` | Session state frontend |
| `src/lib/api.ts` | Client request ke backend |
| `src/styles.css` | Design tokens dan layout auth/map |
