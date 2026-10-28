# Garda Jakarta FE

Frontend React + Vite untuk aplikasi `app.gardajakarta.my.id`. Dashboard memakai pola map-first seperti LaporPak: peta menjadi ruang kerja utama, sedangkan daftar laporan dan detail dibuka sebagai panel sesuai role.

## Scope saat ini

- Login warga di `/login`.
- Login polisi di `/polisi/login`.
- Login admin di `/admin/login`.
- Register publik hanya untuk warga di `/register`.
- Login email/password dan Google OAuth dikelola Better Auth di backend.
- Session memakai HttpOnly cookie dari backend; frontend tidak menyimpan token auth di `localStorage`.
- Peta publik di `/map` bersifat view-only; dashboard terproteksi di `/dashboard` memakai workspace peta yang sama setelah login.
- Warga dapat membuat laporan, memilih titik, melihat riwayat miliknya, dan memantau status.
- Petugas polisi dapat melihat antrian unit, membuka detail laporan, dan memperbarui status sesuai unitnya.
- Admin operasional mendapat tampilan monitoring dan ringkasan agregat tanpa menampilkan data pelapor pada peta publik.
- Logo, favicon, font Plus Jakarta Sans, warna, dan headline memakai aset resmi Garda Jakarta dari landing.
- Ilustrasi auth memakai artwork SVG custom Garda Jakarta yang dibundel lokal di `public/illustrations`.

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

Konfigurasi service tersimpan di Railway: build `npm run build`, start `npm start`, health check `/login`, region `asia-southeast1-eqsg3a`, 1 replica, 1 vCPU, dan 1 GB RAM. Deploy otomatis mengikuti GitHub `main`. Railway tidak menerima `railway.json` untuk service baru; ubah pengaturan melalui dashboard/API atau migrasikan ke named partial IaC jika diperlukan.

## Struktur

| Path | Fungsi |
| --- | --- |
| `src/pages` | Halaman login, register, peta publik, dan dashboard role-aware |
| `src/components/AuthShell.tsx` | Layout auth dan branding resmi |
| `src/components/branding` | SVG logo yang disalin dari landing |
| `src/context` | Bootstrap dan state session |
| `src/lib/api.ts` | Client request dengan `credentials: include` |
| `src/styles.css` | Token visual landing dan layout auth/portal |
| `public/illustrations` | Artwork SVG custom Garda Jakarta |

## Batasan tahap awal

Akun polisi dan admin tidak dibuat lewat register publik. Akun tersebut harus diprovisikan oleh operator melalui backend. Penugasan lintas unit, incident clustering, lampiran S3, notifikasi, dan permission granular masih menjadi tahap berikutnya; dashboard saat ini memvalidasi role, memfilter status, dan mencatat perubahan status yang tersedia pada API.

Jika akun email/password belum terverifikasi, masuk menggunakan password dahulu lalu pilih **Tautkan akun Google**. Login Google selalu mengikuti role tersimpan di backend. Reset password dan verifikasi email melalui pengiriman email belum tersedia pada tahap ini.
