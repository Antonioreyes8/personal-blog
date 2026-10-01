import { promises as fs } from "fs";
import path from "path";

import { revalidatePath } from "next/cache";
import matter from "gray-matter";

import { isAuthorizedPostMutation } from "@/lib/post-submission-auth";

const POSTS_DIRECTORY = path.join(process.cwd(), "src", "content", "posts");

export const runtime = "nodejs";

type PostFileInput = {
	title: string;
	date: string;
	location?: string;
	categories: string[];
	tags: string[];
	thesis?: string;
	conclusion?: string;
	sources?: string[];
	paragraphTitles?: string[];
	content: string;
};

type PostUpdateInput = PostFileInput & {
	slug: string;
};

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function isPostFileInput(value: unknown): value is PostFileInput {
	if (!value || typeof value !== "object") {
		return false;
	}

	const post = value as Record<string, unknown>;

	return (
		typeof post.title === "string" &&
		post.title.trim().length > 0 &&
		typeof post.date === "string" &&
		post.date.trim().length > 0 &&
		typeof post.content === "string" &&
		isStringArray(post.categories) &&
		isStringArray(post.tags) &&
		(post.location === undefined || typeof post.location === "string") &&
		(post.thesis === undefined || typeof post.thesis === "string") &&
		(post.conclusion === undefined || typeof post.conclusion === "string") &&
		(post.sources === undefined || isStringArray(post.sources)) &&
		(post.paragraphTitles === undefined || isStringArray(post.paragraphTitles))
	);
}

function isPostUpdateInput(value: unknown): value is PostUpdateInput {
	return (
		isPostFileInput(value) &&
		typeof (value as Record<string, unknown>).slug === "string" &&
		VALID_SLUG.test((value as PostUpdateInput).slug)
	);
}

function getFrontmatter(input: PostFileInput) {
	return {
		title: input.title.trim(),
		date: input.date,
		...(input.location?.trim() ? { location: input.location.trim() } : {}),
		categories: input.categories,
		tags: input.tags,
		...(input.thesis?.trim() ? { thesis: input.thesis.trim() } : {}),
		...(input.conclusion?.trim()
			? { conclusion: input.conclusion.trim() }
			: {}),
		...(input.sources?.length ? { sources: input.sources } : {}),
		...(input.paragraphTitles
			? { paragraphTitles: input.paragraphTitles }
			: {}),
	};
}

async function getAvailableSlug(title: string) {
	const baseSlug = slugify(title) || `post-${Date.now()}`;
	let slug = baseSlug;
	let suffix = 2;

	while (true) {
		try {
			await fs.access(path.join(POSTS_DIRECTORY, `${slug}.mdx`));
			slug = `${baseSlug}-${suffix}`;
			suffix += 1;
		} catch {
			return slug;
		}
	}
}

export async function POST(request: Request) {
	if (!isAuthorizedPostMutation(request)) {
		return Response.json({ error: "Unauthorized." }, { status: 401 });
	}

	try {
		const input: unknown = await request.json();

		if (!isPostFileInput(input)) {
			return Response.json({ error: "Invalid post data." }, { status: 400 });
		}

		await fs.mkdir(POSTS_DIRECTORY, { recursive: true });
		const slug = await getAvailableSlug(input.title);
		const source = matter.stringify(
			input.content.trim(),
			getFrontmatter(input),
		);
		await fs.writeFile(
			path.join(POSTS_DIRECTORY, `${slug}.mdx`),
			source,
			"utf8",
		);
		revalidatePath("/");

		return Response.json({
			post: {
				...input,
				id: slug,
				slug,
				title: input.title.trim(),
				location: input.location?.trim() || undefined,
			},
		});
	} catch (error) {
		console.error("Unable to write post file", error);
		return Response.json(
			{ error: "Unable to save the post file." },
			{ status: 500 },
		);
	}
}

export async function PUT(request: Request) {
	if (!isAuthorizedPostMutation(request)) {
		return Response.json({ error: "Unauthorized." }, { status: 401 });
	}

	try {
		const input: unknown = await request.json();

		if (!isPostUpdateInput(input)) {
			return Response.json({ error: "Invalid post data." }, { status: 400 });
		}

		const filePath = path.join(POSTS_DIRECTORY, `${input.slug}.mdx`);
		try {
			await fs.access(filePath);
		} catch {
			return Response.json({ error: "Post not found." }, { status: 404 });
		}

		const source = matter.stringify(
			input.content.trim(),
			getFrontmatter(input),
		);
		await fs.writeFile(filePath, source, "utf8");
		revalidatePath("/");

		return Response.json({
			post: {
				...input,
				id: input.slug,
				slug: input.slug,
				title: input.title.trim(),
				location: input.location?.trim() || undefined,
			},
		});
	} catch (error) {
		console.error("Unable to update post file", error);
		return Response.json(
			{ error: "Unable to update the post file." },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: Request) {
	if (!isAuthorizedPostMutation(request)) {
		return Response.json({ error: "Unauthorized." }, { status: 401 });
	}

	const slug = new URL(request.url).searchParams.get("slug");

	if (!slug || !VALID_SLUG.test(slug)) {
		return Response.json({ error: "Invalid post slug." }, { status: 400 });
	}

	try {
		await fs.unlink(path.join(POSTS_DIRECTORY, `${slug}.mdx`));
		revalidatePath("/");
		return Response.json({ success: true });
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return Response.json({ error: "Post not found." }, { status: 404 });
		}

		console.error("Unable to delete post file", error);
		return Response.json(
			{ error: "Unable to delete the post file." },
			{ status: 500 },
		);
	}
}
