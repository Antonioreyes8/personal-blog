This project is an interactive blog and knowledge graph built with Next.js, React, D3, and Sanity.

## Getting Started

Use Node.js 22 LTS (22.12 or later), install dependencies from the lockfile, and configure the environment:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the graph and [http://localhost:3000/studio](http://localhost:3000/studio) for Sanity Studio.

## Environment

Set the values in `.env.local` from your Sanity project:

- `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET` identify the project and dataset. The frontend uses unauthenticated reads, so the dataset must be public.
- `SANITY_WRITE_TOKEN` is a server-only Sanity API token with permission to create, update, and delete posts.
- `POST_SUBMISSION_PASSWORD` protects app submissions, edits, and deletes. Use a random value of at least 16 characters.
- `NEXT_PUBLIC_SANITY_API_VERSION` is optional; the app defaults to `2026-09-30`.

Never expose `SANITY_WRITE_TOKEN` or `POST_SUBMISSION_PASSWORD` with a `NEXT_PUBLIC_` prefix or commit their values. Configure the same server-side secrets in your deployment environment.

## Content

The graph combines published Sanity `post` documents with local MDX files under [`src/content/posts/`](src/content/posts). Posts submitted through the app are saved as Sanity drafts. Review and publish them in Studio; published posts then appear in the graph. Sanity-backed posts can be edited or deleted from the graph using the submission password.

To add repository-managed content, create an `.mdx` file under `src/content/posts/` with `title`, `date`, `categories`, and `tags` frontmatter followed by the post body.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Tech Stack

- Next.js App Router
- React and TypeScript
- Sanity Content Lake and embedded Studio
- Tailwind CSS
- D3
