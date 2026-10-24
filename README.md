# Garda Jakarta FE

Frontend React + Vite untuk aplikasi `app.gardajakarta.my.id`. Scope awalnya adalah fondasi autentikasi dan placeholder peta; fitur peta, laporan, dan dashboard operasional mengikuti tahap produk berikutnya.

## Scope saat ini

- Login warga di `/login`.
- Login polisi di `/polisi/login`.
- Login admin di `/admin/login`.
- Register publik hanya untuk warga di `/register`.
- Login email/password dan Google OAuth dikelola Better Auth di backend.
- Session memakai HttpOnly cookie dari backend; frontend tidak menyimpan token auth di `localStorage`.
- Route terproteksi `/map`, `/polisi`, dan `/admin` sebagai placeholder jujur untuk tahap peta/dashboard berikutnya.
- Logo, favicon, font Plus Jakarta Sans, warna, dan headline memakai aset resmi Garda Jakarta dari landing.
- Ilustrasi auth memakai artwork unDraw yang dibundel lokal di `public/illustrations`.

Referensi pola form: [Height](https://mobbin.com/screens/d239582f-ad2a-4c53-a257-5fa698fc1e78) dan [n8n](https://mobbin.com/screens/9c2f0990-b099-4801-bb97-61d53d6d5f8d) di Mobbin. Identitas visual mengikuti landing Garda Jakarta.

## Menjalankan lokal

```bash
npm ci
copy .env.example .env
npm run dev
```

Buka `http://localhost:5173`. Atur `VITE_API_URL` ke base API, misalnya `http://localhost:4000/api`; tanpa variabel ini Vite memakai proxy `/api` lokal.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run build
```

Untuk menjalankan hasil build seperti Railway:

```bash
npm run build
npm start
```

## Environment Railway

Service `GardaJakarta-FE` memakai branch `main` dari repository ini.

| Variable | Nilai |
| --- | --- |
| `VITE_API_URL` | `https://api.gardajakarta.my.id/api` |

Domain aplikasi: `app.gardajakarta.my.id`.

## Struktur

| Path | Fungsi |
| --- | --- |
| `src/pages` | Halaman login, register, dan portal placeholder |
| `src/components/AuthShell.tsx` | Layout auth dan branding resmi |
| `src/components/branding` | SVG logo yang disalin dari landing |
| `src/context` | Bootstrap dan state session |
| `src/lib/api.ts` | Client request dengan `credentials: include` |
| `src/styles.css` | Token visual landing dan layout auth/portal |
| `public/illustrations` | Artwork unDraw dan kredit sumber |

## Batasan tahap awal

Akun polisi dan admin tidak dibuat lewat register publik. Akun tersebut harus diprovisikan oleh operator melalui backend. Halaman portal saat ini hanya memvalidasi session dan role; data laporan, layer peta, filter, penugasan, moderasi, dan audit UI belum diimplementasikan.

Jika akun email/password belum terverifikasi, masuk menggunakan password dahulu lalu pilih **Tautkan akun Google**. Login Google selalu mengikuti role tersimpan di backend. Reset password dan verifikasi email melalui pengiriman email belum tersedia pada tahap ini.
