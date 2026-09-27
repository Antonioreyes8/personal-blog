This is a [Next.js](https://nextjs.org) starter for a blog-as-second-brain concept, using [React](https://react.dev) for UI, [D3](https://d3js.org) for the interactive graph, and MDX files as the content source.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## What is included

- A homepage with a "second brain" graph experience
- D3 force simulation for node placement and clustering
- Filters for category, location, and year
- Cluster modes for category, date, and location
- Real MDX-backed content in [`src/content/posts/`](src/content/posts)
- Typed content loading in [`src/lib/posts.ts`](src/lib/posts.ts)

## Suggested next steps

To turn this into a real product, the next logical steps are:

- Replace sample data with MDX or CMS-backed blog content
- Create dynamic blog post routes from the same content source
- Add richer edges (shared tags, backlinks, manual relationships)
- Add search, saved views, and animation between layouts
- Optionally sync locations to map coordinates for a geographic mode

## Writing a new post

Add a new `.mdx` file in `src/content/posts/` with this frontmatter shape:

```mdx
---
title: Your Post Title
date: 2026-09-07
location: Mexico City
categories:
  - Design
  - Writing
tags:
  - notes
  - graphs
excerpt: A short summary used in cards and the graph detail panel.
---
```

The homepage graph and `/posts/[slug]` route will pick it up automatically.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Tech stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- D3
