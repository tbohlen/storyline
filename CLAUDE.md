# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js application designed to help users prepare to present deliverables created with AI assistance. The goal is to enhance learning while users work with AI for productivity tasks by helping them understand the AI's thinking process and confidently present work to stakeholders.

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

### Tech Stack
- **Next.js 15.4.1** with App Router
- **React 19.1.0**
- **TypeScript** with strict mode
- **Tailwind CSS v4** with design system
- **shadcn/ui components** for UI primitives

### File Structure
```
src/
├── app/              # Next.js App Router pages
│   ├── layout.tsx    # Root layout with Geist fonts
│   ├── page.tsx      # Home page
│   └── globals.css   # Global styles with Tailwind v4 config
├── components/       # React components (create as needed)
│   └── ui/          # shadcn/ui components
└── lib/
    └── utils.ts      # Utility functions (cn helper)
```

### Component Guidelines
- Use shadcn/ui components from `@/components/ui/`
- Each component should be in its own file
- Use JSDoc comments for all components and major logic
- Import path alias: `@/` maps to `./src/`

### Styling System
- **Tailwind CSS v4** with comprehensive design tokens
- **CSS Variables** for theming (light/dark mode support)
- **shadcn/ui integration** with "new-york" style variant
- Use `cn()` utility from `@/lib/utils` for conditional styling

### Configuration
- **shadcn/ui config**: `components.json` with components in `@/components/ui`
- **TypeScript**: Path aliases configured, strict mode enabled
- **Tailwind**: Modern v4 setup with inline theme configuration in globals.css

## Development Notes

- NEVER use the "any" Typescript type. Our typechecker does not allow this.
- Project uses App Router (not Pages Router)
- Geist Sans and Geist Mono fonts pre-configured
- No testing framework currently configured
- ESLint configured with Next.js and TypeScript rules
- Dark mode support built-in via CSS variables

## Implementation Guidelines

- When implementing a change, only change the specific lines directly required to implement the desired functionality or design changes. DO NOT clean up the code in any way not directly related to that implementation. Do not fix indentation errors from prior commits, change logic unrelated to the desired functionality, or refactor code unrelated to the desired functionaality. Instead, when you finish the implementation, write out a bulleted list of the other improvements you noticed while working so that the user can consider making those improvements in future.
- Always strive to create a clean, DRY (do not repeat yourself), and modular code structure. Avoid extremely long or complex files. Create new components, objects, or functions as needed to make the code easy to follow.
- ALWAYS suggest a better approach to implementing or structuring code to guarantee stability, maintainability, and readability when you identify one.
- Split different React components into different files.
- ALWAYS start by using a shadCN component if one exists, rather than building a new one