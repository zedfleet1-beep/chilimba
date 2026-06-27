# chilimba

Digital savings groups for Zambia — Vue frontend + Express/Prisma backend.

## Quick start

```bash
# Backend (port 4500)
cd backend
cp .env.example .env   # configure database, JWT, Evolution API
npm install
npm run prisma:migrate:deploy
npm run dev

# Frontend (port 5174)
cd frontend
npm install
npm run dev
```

Open http://localhost:5174

## Docs

- [User manual](docs/user-manual.md) — screen-by-screen button guide
- [Product specs](docs/product-specs/index.md)