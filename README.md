# Slate ✨

A beautiful, AI-powered Markdown note-taking app with live preview. Built with Next.js, Tailwind CSS, and DeepSeek AI.

![Slate](public/slate-logo.svg)

## Features

- **Split-Screen Editing** — Write raw Markdown on the left, see a styled preview on the right
- **AI-Powered Writing Assistant** — Improve writing, fix grammar, or summarize text via DeepSeek
- **Dark & Light Mode** — System-aware theming with smooth transitions
- **Export to PDF** — Download your notes as a styled PDF with `⌘P` / `Ctrl+P`
- **Resizable Panes** — Drag to resize the editor and preview panels
- **Floating AI Toolbar** — Sleek action bar for one-click AI transformations

## Tech Stack

| Tech | Purpose |
|------|---------|
| [Next.js 16](https://nextjs.org) (App Router) | Framework |
| [Tailwind CSS 4](https://tailwindcss.com) | Styling |
| [next-themes](https://github.com/pacocoursey/next-themes) | Dark/Light mode |
| [marked](https://marked.js.org) | Markdown parsing (GFM) |
| [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) | PDF export |
| [DeepSeek API](https://platform.deepseek.com) | AI writing assistant |
| [Lucide React](https://lucide.dev) | Icons |
| [Geist Font](https://vercel.com/font) | Typography |

## Getting Started

### Prerequisites

- Node.js 18+
- A [DeepSeek API key](https://platform.deepseek.com/api_keys)

### Installation

```bash
git clone https://github.com/0x3rn/Slate.git
cd Slate
npm install
```

### Configuration

Create a `.env.local` file in the project root:

```bash
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
app/
├── actions/ai.ts          # Server Actions (AI — no key exposed to client)
├── globals.css             # Theme tokens, custom prose, resize handle
├── layout.tsx              # Root layout with ThemeProvider
├── page.tsx               # Main editor (split panes, AI toolbar, PDF export)
components/
├── ai-toolbar.tsx          # Floating AI action bar
├── theme-provider.tsx      # next-themes wrapper
├── theme-toggle.tsx        # Dark/Light toggle
public/
└── slate-logo.svg          # App logo & favicon
```

## Security

The DeepSeek API key is only used in **Next.js Server Actions** (`app/actions/ai.ts`) and is never exposed to the browser.

## License

MIT