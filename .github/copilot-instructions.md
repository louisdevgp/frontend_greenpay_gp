# Copilot Instructions for Dashboard Depenses

## Architecture Overview

This is a React TypeScript dashboard for managing expense requests ("demandes de depenses"), adapted from the TailAdmin template.

- **Framework**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Routing**: React Router DOM v7 with nested routes and guards
- **State Management**: React Context (AuthContext, ThemeContext, SidebarContext)
- **API**: Axios with base URL from `VITE_API_URL` (default: `http://localhost:8000/api`), JWT auth via Bearer token
- **Charts**: ApexCharts for data visualization (e.g., MonthlySalesChart)
- **Forms**: Custom components in `src/components/form/` (Select, MultiSelect, date-picker)
- **Icons**: Centralized exports in `src/icons/index.ts`

## Key Components & Data Flows

- **Layout**: `AppLayout` wraps protected pages with `AppHeader` and `AppSidebar`
- **Auth Flow**: Login stores `{accessToken, user}` in localStorage; `AuthContext` bootstraps by calling `/users/me` to validate token; API interceptor adds `Authorization: Bearer {token}` to requests
- **Pages**: Feature-organized under `src/pages/` (Dashboard/Home uses ecommerce components for metrics/charts)
- **Services**: API calls in `src/services/` (e.g., `auth.service.js` for login/me, `api.js` for axios setup)

Note: Storage structure uses `accessToken`, but `api.js` expects `auth?.token` – align to `token` for consistency.

## Developer Workflows

- **Development**: `npm run dev` starts Vite dev server
- **Build**: `npm run build` compiles TypeScript and bundles with Vite
- **Lint**: `npm run lint` runs ESLint
- **Preview**: `npm run preview` serves built app

No test scripts; debug with React DevTools.

## Project-Specific Patterns

- **CSS Classes**: Use `clsx` and `tailwind-merge` for conditional Tailwind (e.g., in `src/components/ui/button/`)
- **Component Organization**: Feature-based (auth/, ecommerce/ – consider renaming to expenses/ for clarity)
- **Forms**: Extend custom form elements (e.g., `MultiSelect` in `src/components/form/`) for expense forms
- **Hooks**: `useModal` for modal state, `useGoBack` for navigation
- **Utils**: `storage.js` provides `readStorage/writeStorage` for localStorage with JSON parsing
- **Guards**: `AuthGuard` for protected routes, `GuestGuard` for auth pages; `RoleGuard` unused in routing

## Integration Points

- Backend API endpoints (e.g., `/auth/login`, `/users/me`)
- External Libraries: ApexCharts (charts), Flatpickr (date pickers), @react-jvectormap (maps)

## Conventions

- French naming/comments (e.g., "demandes", "paiements")
- `PageMeta` component for page titles/descriptions
- `ScrollToTop` on route changes

Reference `src/App.tsx` for routing structure, `src/context/AuthContext.jsx` for auth logic.</content>
<parameter name="filePath">c:\Users\Louis-ThinkPad T14s\Desktop\PROJET DE GREENPAY\DEMANDE DE DEPENSES\FRONTEND\dashboard_depenses\.github\copilot-instructions.md