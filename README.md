# AI → WordPress Theme Converter

Convert AI-generated HTML into an installable WordPress **Block Theme**. Paste your HTML, run an analysis with an OpenRouter model, and download a ready-to-upload `.zip` theme.

## Features

- **AI-powered analysis** of HTML into a structured intermediate representation (IR).
- **WordPress Block Theme generator** that outputs a ready-to-install theme zip.
- **Model flexibility** via OpenRouter (Gemini, Claude, GPT, Llama, and more).
- **Built-in validation** with Zod to catch schema issues before generating a theme.

## Tech Stack

- **Next.js** (App Router)
- **React**
- **Tailwind CSS**
- **OpenRouter** for model access

## Prerequisites

- **Node.js** 18+ (recommended)
- **OpenRouter API key**

## Getting Started

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:4000` in your browser.

## Usage

1. Paste your AI-generated HTML into the form.
2. Enter your **OpenRouter API key**.
3. Select a model (or paste a custom model ID).
4. Choose the source preset (v0, Bolt, Tailwind UI, or Generic).
5. Click **Analyze** and review the summary.
6. Click **Generate** to download the WordPress theme zip.

> **Note:** Requests are limited to ~100KB of HTML input.

## Scripts

- `npm run dev` — Start the development server on port **4000**.
- `npm run build` — Create a production build.
- `npm run start` — Run the production server.
- `npm run lint` — Run ESLint.

## Project Structure

```
src/
  app/             # Next.js app router (UI + API route)
  components/      # UI components (form, summary, error display)
  generator/       # Theme generation logic (zip output)
  lib/             # Reducers, utilities
  services/        # Pre/post-processing + OpenRouter client
  types/           # Shared types
  validation/      # Zod schemas
```

## OpenRouter Configuration

The app uses OpenRouter's Chat Completions endpoint. Your API key is sent from the browser to the Next.js API route. See `src/services/openrouter-client.ts` for the request configuration (model, temperature, max tokens, timeout, headers).

## Deployment

Build the app and start it with:

```bash
npm run build
npm run start
```

Ensure your environment allows outbound HTTPS to `https://openrouter.ai`.

## License

This project is licensed under the terms of the MIT license. See [LICENSE](LICENSE).
