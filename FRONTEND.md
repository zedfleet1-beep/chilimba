# FRONTEND.md

> Vue 3 + Vite + Pinia + Tailwind conventions. **Read this before writing any UI code.**

## Stack

- **Vue 3** with Composition API and `<script setup lang="ts">` — always.
- **Vite** — dev server with HMR, builds for production.
- **TypeScript** — strict, no `any` without a comment.
- **Pinia** — state management. One store per domain.
- **Vue Router 4** — client-side routing with auth guards.
- **Axios** — HTTP client with interceptors for auth and refresh.
- **Zod** — runtime validation, shared shapes with backend where useful.
- **Tailwind CSS** — utility classes only. No `<style>` blocks unless absolutely necessary.
- **lucide-vue-next** — icons.

## Project Layout

```
frontend/
├── src/
│   ├── api/                # Axios client + typed API functions
│   ├── stores/             # Pinia stores (one per domain)
│   ├── router/             # Vue Router config + guards
│   ├── components/         # Reusable UI components
│   ├── layouts/            # Page layouts
│   ├── pages/              # Route components (PascalCase .vue)
│   ├── composables/        # Reusable composition functions (e.g. useToast)
│   ├── App.vue
│   ├── main.ts
│   ├── style.css           # Tailwind directives + globals
│   └── env.d.ts
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```

## Conventions

- **Pages** are route components, one per route. They live in `src/pages/`.
- **Components** are reusable UI. They live in `src/components/`. Two subfolders:
  - `components/common/` — generic UI (Button, Input, Modal)
  - `components/<domain>/` — domain-specific (CycleCard, MemberRow)
- **Stores** are Pinia stores. Use the setup style (`defineStore('name', () => { ... })`).
- **API functions** are in `src/api/<domain>.ts`. Each function is typed end-to-end.
- **No direct `fetch` calls** in components — always go through `src/api/`.
- **No direct DOM access** in components — use a composable or component instead.
- **Props/emits** are typed with `defineProps<{}>()` and `defineEmits<{}>()`.
- **Reactive state** is `ref()` for primitives, `reactive()` for objects, `computed()` for derived.

## API Client

`src/api/client.ts` exports a configured Axios instance:

- `baseURL: import.meta.env.VITE_API_BASE` (default `/api/v1`)
- Request interceptor: attaches `Authorization: Bearer <accessToken>` from the auth store
- Response interceptor: on 401, calls `/auth/refresh`, retries the original request once

The auth store holds the access token in memory (not localStorage — security trade-off, see `SECURITY.md`).

## Auth Flow

```
/signup  →  /otp  →  /dashboard
/login   →  /dashboard
/logout  →  /login
```

The router has a `beforeEach` guard:

- Routes that require auth (`/dashboard`, future `/groups/*`, etc.) check `authStore.isAuthenticated`. If false → redirect to `/login`.
- Routes that should NOT be visited while logged in (`/login`, `/signup`) check the same flag and redirect to `/dashboard`.

## Error Handling

- API errors come back as `{success: false, error: {code, message}}`.
- The Axios interceptor normalises this into a thrown `ApiError`.
- A global `useToast()` composable shows user-friendly messages.
- Never show raw `error.message` to the user — translate by `error.code` from a known map.

## Forms

- Use plain Vue reactive state + Zod validation in the page.
- The backend is the source of truth for validation, but client-side validation is for UX.
- For complex forms, build small composables like `useForm(schema)`.
- Disable submit while `pending === true`.

## Styling

- Tailwind utility classes only. No CSS-in-JS, no `<style scoped>` blocks unless absolutely necessary.
- Use `@apply` in `style.css` for repeating patterns, not in components.
- Mobile-first: write base styles for mobile, add `sm:`, `md:`, `lg:` for larger.
- Stick to the conventions in `DESIGN.md`.

## Testing

- **Vitest** is the default for Vue 3 + Vite projects. (Not yet wired up in Week 1–2.)
- **Vue Test Utils** for component tests.
- For now, we lean on manual smoke tests in the browser.

## Build Targets

- `npm run dev` → Vite dev server on :5173 with HMR
- `npm run build` → `vue-tsc` typecheck + Vite build → `dist/`
- `npm run preview` → serve `dist/` for sanity-check
