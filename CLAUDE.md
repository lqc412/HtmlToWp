# AI-to-WordPress Theme Converter

## Language Rule

All code comments, documentation, CLAUDE.md, and plan files MUST be written in English.

## Project Overview

User pastes AI-generated HTML → LLM semantic parsing → outputs installable WordPress Block Theme `.zip`.

Stack: Next.js (App Router) + TypeScript + TailwindCSS + Zod + JSZip + OpenRouter API (multi-model support)

## Architecture

### Data Flow

```
HTML Input → HTML Preprocessor → OpenRouter API (user-selected model) → IR JSON (Zod validated) → Block Markup Generator → .zip
```

### Three-Layer Separation

| Layer | Responsibility | Location |
|-------|---------------|----------|
| AI Parsing | HTML → IR JSON | `src/services/` |
| Validation | Zod runtime validation | `src/validation/` |
| Generation | IR → WordPress theme files | `src/generator/` |

### API Route vs Client

- `openrouter-client.ts` is designed for both server-side and client-side use
- API Route (`/api/parse`) contains preprocessing + OpenRouter + validation
- If Vercel times out, OpenRouter call can be switched to client-side
- Supports multiple models via OpenRouter (Gemini, Claude, GPT, Llama, etc.)

## IR Schema (Core Data Structure)

IR (Intermediate Representation) is the contract between LLM output and Theme generator.

- Type definitions: `src/types/ir.ts`
- Zod schemas: `src/validation/ir-schema.ts`
- Top-level structure: `IRDocument { metadata, designTokens, header?, sections[], footer? }`
- 8 NodeTypes: heading, paragraph, image, button, list, spacer, group, navigation
- `sectionIntent` is a soft label (mislabeling does not affect rendering)
- `motionIntent` is fully downgraded to static in MVP
- `style?: Record<string, string>` for styles that cannot be mapped to theme.json

## WordPress Block Markup Rules

Generator outputs WordPress Block Markup strings (HTML comments + standard HTML).

Key rules:
- `wp:button` MUST be wrapped in `wp:buttons` container
- `wp:navigation` is downgraded to text links inside `wp:group` for MVP
- Section with background image → `wp:cover`; with background color → `wp:group` with style
- columns layout → `wp:columns > wp:column`
- grid layout → `wp:group` with `layout.type: "grid"`
- JSON attributes in block comments MUST strictly match HTML structure (WP parser is very strict)

## Code Conventions

### Dumb UI Pattern

- Components: render UI only + emit events via props
- Page (`page.tsx`): assemble components + business logic (useReducer)
- Services: pure functions, no React dependency
- Generator: pure string concatenation functions, no side effects

### State Machine

Uses useReducer. State flow: idle → analyzing → analyzed → generating → done | error

### Naming

- React hooks use `use` prefix
- Regular functions use verbs: `generateThemeZip`, `parseHTMLtoIR`, `buildSystemPrompt`
- File names use kebab-case

### Error Handling

- OpenRouter API errors classified as: INVALID_API_KEY, RATE_LIMITED, TOKEN_OVERFLOW, INVALID_RESPONSE, SCHEMA_VIOLATION, NETWORK_ERROR
- Zod validation failures provide specific missing field information
- Non-critical operations use silent failure (return null + console.warn)

## Roadmap

### MVP (Current)

- [x] Architecture decisions finalized
- [x] Phase 1: Foundation (scaffolding + types + Zod)
- [x] Phase 2: AI Pipeline (preprocessing + OpenRouter + API Route)
- [x] Phase 3: Generator Engine (Block Markup + theme files + zip)
- [x] Phase 4: UI (page + components + end-to-end)
- [x] Phase 5: Polish (error handling + prompt tuning)
- [x] Phase 6: OpenRouter Migration (multi-model support)

### v1.1 (Post-MVP)

- Layer 2 Custom CSS (raw CSS extraction fallback)
- Motion CSS generation (read motionIntent from IR)
- Google Fonts registration in theme.json
- Real wp:navigation block

### v2.0 (Future)

- Media upload to WP media library (requires backend)
- SaaS model (server-side API key + per-use billing)
- Multi-page template support
- Theme preview (iframe simulation)
- WordPress plugin version

## Key Files Reference

| File | Responsibility |
|------|---------------|
| `src/types/ir.ts` | IR type definitions (core data model) |
| `src/validation/ir-schema.ts` | Zod validation (LLM output gatekeeper) |
| `src/services/openrouter-client.ts` | OpenRouter API call (server/client dual-use) |
| `src/services/html-preprocessor.ts` | HTML cleanup (save LLM tokens) |
| `src/services/prompt-builder.ts` | System prompt builder |
| `src/generator/block-renderer.ts` | IR → WP Block Markup (core renderer) |
| `src/generator/theme-generator.ts` | Entry point: IR → zip |
| `src/generator/files/theme-json.ts` | DesignTokens → theme.json |
| `src/lib/reducer.ts` | useReducer state machine |
| `src/app/api/parse/route.ts` | API Route: preprocessing + LLM + validation |

## Testing

- Block Markup references WordPress Twenty Twenty-Four theme source
- Generated .zip must activate successfully in WP 6.7
- Zod schema tested with fixture JSON files
