# DESIGN.md

> UI/UX design system. **Stub for Week 1–2.** Real system lands in Week 7–8.

## Status

This document is a placeholder. A real design system (typography scale, color tokens, component library, spacing scale, motion) will be created in Week 7–8 once the screens have stabilised. For now, we use Tailwind defaults with a small set of conventions.

## Conventions Used Now

- **Primary action color:** `emerald-600` (Chilimba's brand-adjacent green)
- **Destructive color:** `red-600`
- **Neutral text:** `slate-900` for body, `slate-500` for secondary
- **Layout:** max-w-md centered cards on auth pages, full-bleed on app pages
- **Border radius:** `rounded-xl` for cards, `rounded-lg` for inputs, `rounded-full` for avatars
- **Form inputs:** `h-11 px-3 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200`
- **Primary button:** `h-11 px-4 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:bg-slate-300`

## When You Add a Screen

1. Use `<AuthLayout>` for all unauthenticated pages (SignUp, OtpVerify, Login).
2. Use a centered card with `max-w-md` and `p-8`.
3. Form fields stack vertically with `space-y-4`.
4. Use `lucide-vue-next` for icons.
5. The submit button is full-width at the bottom.

## Open Questions for Week 7–8

- Are we doing a mobile app later? (Yes, per Phase 3.) Should the design system be mobile-first from the start?
- Brand identity: who owns color/logo decisions?
- Accessibility audit target (WCAG 2.1 AA? AAA?)
- Dark mode?
