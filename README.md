# Vocito Studio

AI-powered video generation interface. Prompt-driven, review-based pipeline that produces premium launch videos and marketing content.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Aceternity UI + Framer Motion
- Deployed on Vercel
- Backend: FastAPI on Railway (separate repo)
- Database: Supabase

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in .env.local with API keys
npm run dev
```

Opens at http://localhost:3000

## Deploy

Push to `main` auto-deploys to Vercel production (studio.vocito.ai).
Preview deploys happen on all other branches.

## Project Structure

```
src/
├── app/           # Next.js App Router pages
├── components/    # React components (UI + feature)
├── lib/           # Utilities, clients, helpers
├── hooks/         # React hooks
└── types/         # TypeScript type definitions
```
