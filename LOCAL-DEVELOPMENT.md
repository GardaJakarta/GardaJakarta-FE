# Menjalankan lokal Garda Jakarta

## Port service

- Landing (`GardaJakarta-Landing`): `http://localhost:3000`
- FE (`GardaJakarta-FE`): `http://localhost:5173`
- BE (`GardaJakarta-BE`): `http://localhost:4000`

## Backend

```powershell
cd C:\Dev\GardaJakarta\GardaJakarta-BE
npm ci
copy .env.example .env
npm run prisma:migrate:dev
npm run dev
```

Isi `.env` backend dengan PostgreSQL milik tim (lokal atau Railway), lalu gunakan nilai aman berikut untuk development:

```dotenv
PORT=4000
BETTER_AUTH_URL=http://localhost:4000
BETTER_AUTH_SECRET=buat-secret-random-minimal-32-karakter
CORS_ORIGIN=http://localhost:5173 http://127.0.0.1:5173 http://localhost:3000 http://127.0.0.1:3000
NODE_ENV=development
```

Jangan commit `.env`, password database, Google secret, atau S3 secret.

## FE

```powershell
cd C:\Dev\GardaJakarta\GardaJakarta-FE
npm ci
copy .env.example .env
npm run dev
```

`.env` FE:

```dotenv
VITE_API_URL=http://localhost:4000/api
```

## Landing

```powershell
cd C:\Dev\GardaJakarta\GardaJakarta-Landing
npm ci
npm run dev
```

Landing tidak membutuhkan env untuk development. Jalankan BE lebih dulu, kemudian FE, lalu Landing. FE `/map` adalah view-only; `/dashboard` memakai workspace yang sama setelah login dan menyediakan form laporan hanya untuk warga.
