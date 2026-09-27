import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";

import matter from "gray-matter";

const POSTS_DIRECTORY = path.join(process.cwd(), "src", "content", "posts");

type PostFrontmatter = {
	title: string;
	date: string;
	location?: string;
	categories: string[];
	tags: string[];
	thesis?: string;
	conclusion?: string;
	sources?: string[];
	paragraphTitles?: string[];
};

export type PostSummary = PostFrontmatter & {
	id: string;
	slug: string;
};

export type Post = PostSummary & {
	content: string;
};

function assertString(value: unknown, fieldName: string, slug: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Post "${slug}" is missing a valid "${fieldName}" field.`);
	}

	return value.trim();
}

function assertDateString(value: unknown, slug: string): string {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}

	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}

	throw new Error(`Post "${slug}" is missing a valid "date" field.`);
}

function assertStringArray(
	value: unknown,
	fieldName: string,
	slug: string,
): string[] {
	if (
		!Array.isArray(value) ||
		value.some((item) => typeof item !== "string" || item.trim().length === 0)
	) {
		throw new Error(
			`Post "${slug}" is missing a valid "${fieldName}" string array.`,
		);
	}

	return value.map((item) => item.trim());
}

function parseOptionalString(value: unknown): string {
	if (typeof value !== "string") {
		return "";
	}

	return value.trim();
}

function parseOptionalStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean);
}

function parsePost(slug: string, fileContents: string): Post {
	const { data, content } = matter(fileContents);

	return {
		id: slug,
		slug,
		title: assertString(data.title, "title", slug),
		date: assertDateString(data.date, slug),
		location: parseOptionalString(data.location),
		categories: assertStringArray(data.categories, "categories", slug),
		tags: assertStringArray(data.tags, "tags", slug),
		thesis: parseOptionalString(data.thesis),
		conclusion: parseOptionalString(data.conclusion),
		sources: parseOptionalStringArray(data.sources),
		...(data.paragraphTitles === undefined
			? {}
			: { paragraphTitles: parseOptionalStringArray(data.paragraphTitles) }),
		content: content.trim(),
	};
}

const getPostSlugs = cache(async () => {
	const entries = await fs.readdir(POSTS_DIRECTORY, { withFileTypes: true });

	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
		.map((entry) => entry.name.replace(/\.mdx$/, ""))
		.sort((left, right) => left.localeCompare(right));
});

export const getAllPosts = cache(async (): Promise<Post[]> => {
	const slugs = await getPostSlugs();
	const posts = await Promise.all(
		slugs.map(async (slug) => {
			const filePath = path.join(POSTS_DIRECTORY, `${slug}.mdx`);
			const source = await fs.readFile(filePath, "utf8");
			return parsePost(slug, source);
		}),
	);

	return posts.sort((left, right) => right.date.localeCompare(left.date));
});

export const getPostBySlug = cache(
	async (slug: string): Promise<Post | null> => {
		const slugs = await getPostSlugs();

		if (!slugs.includes(slug)) {
			return null;
		}

		const filePath = path.join(POSTS_DIRECTORY, `${slug}.mdx`);
		const source = await fs.readFile(filePath, "utf8");

		return parsePost(slug, source);
	},
);
