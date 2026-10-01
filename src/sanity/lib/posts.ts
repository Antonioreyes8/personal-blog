import { client } from "./client";

import type { Post } from "@/lib/posts";

const POSTS_QUERY = `*[_type == "post" && defined(slug.current)] | order(date desc) {
	_id,
	title,
	"slug": slug.current,
	date,
	location,
	categories,
	tags,
	thesis,
	paragraphs[]{_key, title, content},
	conclusion,
	sources
}`;

type SanityPostDocument = {
	_id: string;
	title: string;
	slug: string;
	date: string;
	location?: string;
	categories?: string[];
	tags?: string[];
	thesis?: string;
	paragraphs?: Array<{
		_key: string;
		title?: string;
		content: string;
	}>;
	conclusion?: string;
	sources?: string[];
};

export async function getPublishedSanityPosts(): Promise<Post[]> {
	const documents = await client
		.withConfig({ perspective: "published" })
		.fetch<SanityPostDocument[]>(POSTS_QUERY);

	return documents.map((document) => {
		const paragraphs = document.paragraphs ?? [];
		const thesis = document.thesis ?? "";
		const conclusion = document.conclusion ?? "";

		return {
			id: document._id,
			slug: document.slug,
			title: document.title,
			date: document.date,
			location: document.location ?? "",
			categories: document.categories ?? [],
			tags: document.tags ?? [],
			thesis,
			paragraphs,
			paragraphTitles: paragraphs.map((paragraph) => paragraph.title ?? ""),
			conclusion,
			sources: document.sources ?? [],
			content: [
				thesis,
				...paragraphs.map((paragraph) => paragraph.content),
				conclusion,
			]
				.filter(Boolean)
				.join("\n\n"),
			source: "sanity",
		};
	});
}