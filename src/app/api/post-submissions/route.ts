import { revalidatePath } from "next/cache";

import { isAuthorizedPostMutation } from "@/lib/post-submission-auth";
import { client } from "@/sanity/lib/client";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64_000;
const MAX_TAGS = 8;
const MAX_SINGLE_TAG = 24;
const SCHOOL_CATEGORIES = new Set([
	"Math",
	"Science",
	"Art",
	"History",
	"Geography",
	"Literature",
]);

type ParagraphInput = {
	title: string;
	content: string;
};

type PostSubmission = {
	title: string;
	date: string;
	location: string;
	category: string;
	tags: string[];
	thesis: string;
	paragraphs: ParagraphInput[];
	conclusion: string;
	sources: string[];
};

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function getPostSubmissionValidationErrors(value: unknown): string[] {
	if (!value || typeof value !== "object") {
		return ["Request body must be an object."];
	}

	const post = value as Record<string, unknown>;
	const paragraphs = post.paragraphs;
	const isValidDate =
		typeof post.date === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(post.date) &&
		!Number.isNaN(Date.parse(`${post.date}T00:00:00Z`));
	const errors: string[] = [];

	if (
		typeof post.title !== "string" ||
		post.title.trim().length === 0 ||
		post.title.length > 90
	) {
		errors.push("Title must be 1 to 90 characters.");
	}
	if (!isValidDate) {
		errors.push("Date must be a valid date in YYYY-MM-DD format.");
	}
	if (typeof post.location !== "string" || post.location.length > 60) {
		errors.push("Location must be 60 characters or fewer.");
	}
	if (
		typeof post.category !== "string" ||
		!SCHOOL_CATEGORIES.has(post.category)
	) {
		errors.push("Choose a valid category.");
	}
	if (!isStringArray(post.tags)) {
		errors.push("Tags must be a list of text values.");
	} else {
		if (post.tags.length === 0 || post.tags.length > MAX_TAGS) {
			errors.push(`Use between 1 and ${MAX_TAGS} tags.`);
		}
		if (
			post.tags.some(
				(tag) => !/^[a-z0-9-]+$/.test(tag) || tag.length > MAX_SINGLE_TAG,
			)
		) {
			errors.push(
				`Tags can contain lowercase letters, numbers, and hyphens only, up to ${MAX_SINGLE_TAG} characters each.`,
			);
		}
	}
	if (
		typeof post.thesis !== "string" ||
		post.thesis.trim().length === 0 ||
		post.thesis.length > 6000
	) {
		errors.push("Thesis must contain 1 to 6000 characters.");
	}
	if (
		!Array.isArray(paragraphs) ||
		paragraphs.length === 0 ||
		paragraphs.length > 40
	) {
		errors.push("Include between 1 and 40 paragraphs.");
	} else {
		paragraphs.forEach((paragraph, index) => {
			if (
				paragraph === null ||
				typeof paragraph !== "object" ||
				typeof paragraph.title !== "string" ||
				paragraph.title.length > 120 ||
				typeof paragraph.content !== "string" ||
				paragraph.content.trim().length === 0 ||
				paragraph.content.length > 6000
			) {
				errors.push(
					`Paragraph ${index + 1} has invalid content or a heading over 120 characters.`,
				);
			}
		});
	}
	if (
		typeof post.conclusion !== "string" ||
		post.conclusion.trim().length === 0 ||
		post.conclusion.length > 6000
	) {
		errors.push("Conclusion must contain 1 to 6000 characters.");
	}
	if (!isStringArray(post.sources)) {
		errors.push("Sources must be a list of text values.");
	} else if (
		post.sources.length > 20 ||
		post.sources.some((source) => source.length > 1000)
	) {
		errors.push("Use no more than 20 sources, each 1000 characters or fewer.");
	}

	return errors;
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function getSanityPostFields(post: PostSubmission) {
	return {
		title: post.title.trim(),
		date: post.date,
		location: post.location.trim(),
		categories: [post.category],
		tags: post.tags,
		thesis: post.thesis.trim(),
		paragraphs: post.paragraphs.map((paragraph) => ({
			_key: crypto.randomUUID(),
			_type: "object",
			title: paragraph.title.trim(),
			content: paragraph.content.trim(),
		})),
		conclusion: post.conclusion.trim(),
		sources: post.sources.map((source) => source.trim()).filter(Boolean),
	};
}

function getWriteClient() {
	const writeToken = process.env.SANITY_WRITE_TOKEN;
	return writeToken
		? client.withConfig({ token: writeToken, useCdn: false })
		: null;
}

function isValidPublishedId(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^[A-Za-z0-9._-]{1,128}$/.test(value) &&
		!value.startsWith("drafts.")
	);
}

export async function POST(request: Request) {
	if (!isAuthorizedPostMutation(request)) {
		return Response.json(
			{ error: "Invalid submission password." },
			{ status: 401 },
		);
	}

	const writeClient = getWriteClient();
	if (!writeClient) {
		return Response.json(
			{ error: "Post submissions are not configured." },
			{ status: 503 },
		);
	}

	let rawBody: string;
	try {
		rawBody = await request.text();
	} catch {
		return Response.json({ error: "Invalid request body." }, { status: 400 });
	}

	if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
		return Response.json(
			{ error: "Submission is too large." },
			{ status: 413 },
		);
	}

	let input: unknown;
	try {
		input = JSON.parse(rawBody);
	} catch {
		return Response.json({ error: "Invalid request body." }, { status: 400 });
	}

	const validationErrors = getPostSubmissionValidationErrors(input);
	if (validationErrors.length > 0) {
		return Response.json(
			{ error: "Invalid post data.", details: validationErrors },
			{ status: 400 },
		);
	}
	const post = input as PostSubmission;

	try {
		const draftId = `drafts.${crypto.randomUUID()}`;
		const slug = `${slugify(post.title).slice(0, 72) || "post"}-${crypto.randomUUID().slice(0, 8)}`;

		await writeClient.create({
			_id: draftId,
			_type: "post",
			slug: { _type: "slug", current: slug },
			...getSanityPostFields(post),
		});

		return Response.json({ submitted: true }, { status: 201 });
	} catch (error) {
		console.error("Unable to submit post for review", error);
		return Response.json(
			{ error: "Unable to submit the post. Please try again." },
			{ status: 500 },
		);
	}
}

export async function PUT(request: Request) {
	if (!isAuthorizedPostMutation(request)) {
		return Response.json(
			{ error: "Invalid submission password." },
			{ status: 401 },
		);
	}

	const writeClient = getWriteClient();
	if (!writeClient) {
		return Response.json(
			{ error: "Post editing is not configured." },
			{ status: 503 },
		);
	}

	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return Response.json({ error: "Invalid request body." }, { status: 400 });
	}

	if (!input || typeof input !== "object") {
		return Response.json({ error: "Invalid post data." }, { status: 400 });
	}

	const record = input as Record<string, unknown>;
	if (!isValidPublishedId(record.id)) {
		return Response.json({ error: "Invalid post ID." }, { status: 400 });
	}

	const validationErrors = getPostSubmissionValidationErrors(input);
	if (validationErrors.length > 0) {
		return Response.json(
			{ error: "Invalid post data.", details: validationErrors },
			{ status: 400 },
		);
	}

	try {
		await writeClient
			.patch(record.id)
			.set(getSanityPostFields(input as PostSubmission))
			.commit();
		revalidatePath("/");
		return Response.json({ updated: true });
	} catch (error) {
		console.error("Unable to update Sanity post", error);
		return Response.json(
			{ error: "Unable to update the post. Please try again." },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: Request) {
	if (!isAuthorizedPostMutation(request)) {
		return Response.json(
			{ error: "Invalid submission password." },
			{ status: 401 },
		);
	}

	const writeClient = getWriteClient();
	if (!writeClient) {
		return Response.json(
			{ error: "Post deletion is not configured." },
			{ status: 503 },
		);
	}

	const id = new URL(request.url).searchParams.get("id");
	if (!isValidPublishedId(id)) {
		return Response.json({ error: "Invalid post ID." }, { status: 400 });
	}

	try {
		await writeClient.transaction().delete(id).delete(`drafts.${id}`).commit();
		revalidatePath("/");
		return Response.json({ deleted: true });
	} catch (error) {
		console.error("Unable to delete Sanity post", error);
		return Response.json(
			{ error: "Unable to delete the post. Please try again." },
			{ status: 500 },
		);
	}
}
