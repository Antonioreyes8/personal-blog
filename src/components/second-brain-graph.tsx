"use client";

import * as d3 from "d3";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type { Post } from "@/lib/posts";

import { GraphFilters } from "./second-brain/graph-filters";
import { PostComposer } from "./second-brain/post-composer";
import { SelectedPostDialog } from "./second-brain/post-detail";
import {
	emptySourceDraft,
	formatSourceCitation,
	parseSourceCitation,
	type PostDraft,
} from "./second-brain/types";

type GraphNode = Post &
	d3.SimulationNodeDatum & {
		color: string;
		primaryCategory: string;
		year: string;
	};

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
	source: string | GraphNode;
	target: string | GraphNode;
	weight: number;
};

const WIDTH = 1600;
const HEIGHT = 900;
const ALL_OPTION = "All";
const LEGACY_LOCAL_POSTS_KEY = "second-brain-user-posts";
const LOCAL_POSTS_KEY = "second-brain-user-posts-v2";
const NODE_RADIUS = 60;
const MAX_TAGS = 8;
const MAX_SINGLE_TAG = 24;

const SCHOOL_CATEGORIES = [
	"Math",
	"Science",
	"Art",
	"History",
	"Geography",
	"Literature",
] as const;

const categoryAlias: Record<string, (typeof SCHOOL_CATEGORIES)[number]> = {
	data: "Math",
	design: "Art",
	"second brain": "Science",
	systems: "Science",
	travel: "Geography",
	urbanism: "Geography",
	writing: "Literature",
	math: "Math",
	science: "Science",
	art: "Art",
	history: "History",
	geography: "Geography",
	literature: "Literature",
};

const categoryColors: Record<(typeof SCHOOL_CATEGORIES)[number], string> = {
	Math: "#a9bad0",
	Science: "#aebd9f",
	Art: "#c7b1c6",
	History: "#c9c1a0",
	Geography: "#c6a4a2",
	Literature: "#9dbdc0",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

const emptyDraft: PostDraft = {
	title: "",
	category: "Science",
	location: "",
	date: new Date().toISOString().slice(0, 10),
	tags: "",
	thesis: "",
	paragraphs: [{ title: "", content: "" }],
	conclusion: "",
	sources: [{ ...emptySourceDraft }],
};

function getYear(post: Post) {
	return new Date(post.date).getFullYear().toString();
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

function normalizeCategory(value: string): (typeof SCHOOL_CATEGORIES)[number] {
	const mapped = categoryAlias[value.trim().toLowerCase()];
	return mapped ?? "Science";
}

function normalizePost(post: Post): Post {
	const categories =
		post.categories.length > 0
			? Array.from(
					new Set(
						post.categories.map((category) => normalizeCategory(category)),
					),
				)
			: ["Science"];

	return {
		...post,
		categories,
	};
}

function getPrimaryCategory(post: Post) {
	return normalizeCategory(post.categories[0] ?? "Science");
}

function intersects(left: string[], right: string[]) {
	return left.filter((item) => right.includes(item));
}

function getNodeTitleLines(title: string): [string, string?] {
	const words = title.split(/\s+/).filter(Boolean);
	if (words.length <= 2 && title.length <= 16) {
		return [title];
	}

	let firstLine = "";
	let secondLine = "";

	for (const word of words) {
		const firstCandidate = firstLine ? `${firstLine} ${word}` : word;
		if (firstCandidate.length <= 16 || firstLine.length === 0) {
			firstLine = firstCandidate;
			continue;
		}

		const secondCandidate = secondLine ? `${secondLine} ${word}` : word;
		if (secondCandidate.length <= 16) {
			secondLine = secondCandidate;
			continue;
		}

		secondLine = `${secondLine.slice(0, 13)}...`;
		break;
	}

	if (!secondLine && firstLine.length > 16) {
		return [firstLine.slice(0, 13) + "..."];
	}

	return [firstLine, secondLine || undefined];
}

function parseTags(input: string) {
	return Array.from(
		new Set(
			input
				.split(",")
				.map((tag) => tag.trim().toLowerCase())
				.filter((tag) => /^[a-z0-9-]+$/.test(tag)),
		),
	);
}

function buildGraphData(input: Post[]) {
	const nodes: GraphNode[] = input.map((post) => ({
		...post,
		primaryCategory: getPrimaryCategory(post),
		year: getYear(post),
		color: categoryColors[getPrimaryCategory(post)],
	}));

	const links: GraphLink[] = [];

	for (let index = 0; index < nodes.length; index += 1) {
		const current = nodes[index];

		for (
			let compareIndex = index + 1;
			compareIndex < nodes.length;
			compareIndex += 1
		) {
			const candidate = nodes[compareIndex];
			const sharedTags = intersects(current.tags, candidate.tags);

			if (sharedTags.length > 0) {
				links.push({
					source: current.id,
					target: candidate.id,
					weight: sharedTags.length,
				});
			}
		}
	}

	return { nodes, links };
}

type SecondBrainGraphProps = {
	posts: Post[];
};

export function SecondBrainGraph({ posts }: SecondBrainGraphProps) {
	const router = useRouter();
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [categoryFilter, setCategoryFilter] = useState(ALL_OPTION);
	const [locationFilter, setLocationFilter] = useState(ALL_OPTION);
	const [yearFilter, setYearFilter] = useState(ALL_OPTION);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [userPosts, setUserPosts] = useState<Post[]>([]);
	const [hasLoadedUserPosts, setHasLoadedUserPosts] = useState(false);
	const [isComposerOpen, setIsComposerOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingSource, setEditingSource] = useState<Post["source"] | null>(
		null,
	);
	const [draft, setDraft] = useState<PostDraft>(emptyDraft);
	const [composerError, setComposerError] = useState<string | null>(null);
	const [isSubmittingPost, setIsSubmittingPost] = useState(false);
	const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
	const [isDeletingPost, setIsDeletingPost] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	useEffect(() => {
		window.localStorage.removeItem(LEGACY_LOCAL_POSTS_KEY);
		const saved = window.localStorage.getItem(LOCAL_POSTS_KEY);
		queueMicrotask(() => {
			if (saved) {
				try {
					const parsed = JSON.parse(saved) as Post[];
					setUserPosts(parsed.map((post) => normalizePost(post)));
				} catch {
					setUserPosts([]);
				}
			}
			setHasLoadedUserPosts(true);
		});
	}, []);

	useEffect(() => {
		if (!hasLoadedUserPosts) {
			return;
		}

		window.localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(userPosts));
	}, [hasLoadedUserPosts, userPosts]);

	const allPosts = useMemo(() => {
		const uniquePosts = new Map<string, Post>();

		for (const post of [
			...posts.map((post) => normalizePost(post)),
			...userPosts,
		]) {
			uniquePosts.set(post.id, post);
		}

		return Array.from(uniquePosts.values());
	}, [posts, userPosts]);

	const categories = useMemo(() => [ALL_OPTION, ...SCHOOL_CATEGORIES], []);
	const locations = useMemo(
		() => [
			ALL_OPTION,
			...Array.from(
				new Set(
					allPosts
						.map((post) => post.location ?? "")
						.filter((location) => location.trim().length > 0),
				),
			).sort(),
		],
		[allPosts],
	);
	const years = useMemo(
		() => [
			ALL_OPTION,
			...Array.from(new Set(allPosts.map((post) => getYear(post)))).sort(),
		],
		[allPosts],
	);

	const filteredPosts = useMemo(
		() =>
			allPosts.filter((post) => {
				const categoryMatch =
					categoryFilter === ALL_OPTION ||
					post.categories.includes(categoryFilter);
				const locationMatch =
					locationFilter === ALL_OPTION ||
					(post.location ?? "") === locationFilter;
				const yearMatch =
					yearFilter === ALL_OPTION || getYear(post) === yearFilter;

				return categoryMatch && locationMatch && yearMatch;
			}),
		[allPosts, categoryFilter, locationFilter, yearFilter],
	);

	const { nodes, links } = useMemo(
		() => buildGraphData(filteredPosts),
		[filteredPosts],
	);

	const selectedPost =
		selectedId && filteredPosts.some((post) => post.id === selectedId)
			? (filteredPosts.find((post) => post.id === selectedId) ?? null)
			: null;
	function closeComposer() {
		setIsComposerOpen(false);
		setEditingId(null);
		setEditingSource(null);
		setDraft(emptyDraft);
		setComposerError(null);
	}

	function openComposerForEdit(post: Post) {
		setEditingId(post.id);
		setEditingSource(post.source ?? null);
		const thesis = post.thesis ?? "";
		const conclusion = post.conclusion ?? "";
		const bodyContent = post.content
			.replace(thesis, "")
			.replace(conclusion, "")
			.replace(/\n{3,}/g, "\n\n")
			.trim();

		setDraft({
			title: post.title,
			category: post.categories[0] ?? "Science",
			location: post.location ?? "",
			date: post.date,
			tags: post.tags.join(", "),
			thesis,
			paragraphs: bodyContent
				? bodyContent
						.split(/\n\s*\n/)
						.filter(Boolean)
						.map((paragraph, index) => ({
							title: post.paragraphTitles?.[index] ?? "",
							content: paragraph,
						}))
				: [{ title: "", content: "" }],
			conclusion,
			sources:
				post.sources && post.sources.length > 0
					? post.sources.map(parseSourceCitation)
					: [{ ...emptySourceDraft }],
		});
		setIsComposerOpen(true);
		setComposerError(null);
		setSelectedId(null);
	}

	async function deletePost(post: Post) {
		const isSanityPost = post.source === "sanity";
		const isServerPost =
			isSanityPost || posts.some((existingPost) => existingPost.id === post.id);
		const submissionPassword = isServerPost
			? window.prompt("Enter the submission password to continue.")
			: null;
		if (isServerPost && !submissionPassword) {
			return;
		}

		setIsDeletingPost(true);
		setDeleteError(null);

		try {
			if (isSanityPost) {
				const response = await fetch(
					`/api/post-submissions?id=${encodeURIComponent(post.id)}`,
					{
						method: "DELETE",
						headers: {
							Authorization: `Bearer ${submissionPassword}`,
						},
					},
				);

				if (!response.ok) {
					const result = (await response.json().catch(() => ({}))) as {
						error?: string;
					};
					throw new Error(result.error ?? "Unable to delete the post.");
				}
			} else if (posts.some((existingPost) => existingPost.id === post.id)) {
				const response = await fetch(
					`/api/posts?slug=${encodeURIComponent(post.slug)}`,
					{
						method: "DELETE",
						headers: {
							Authorization: `Bearer ${submissionPassword}`,
						},
					},
				);

				if (!response.ok) {
					const result = (await response.json().catch(() => ({}))) as {
						error?: string;
					};
					throw new Error(result.error ?? "Unable to delete the post.");
				}
			}

			setUserPosts((previous) =>
				previous.filter((userPost) => userPost.id !== post.id),
			);
			setSelectedId(null);
			router.refresh();
		} catch (error) {
			setDeleteError(
				error instanceof Error ? error.message : "Unable to delete the post.",
			);
		} finally {
			setIsDeletingPost(false);
		}
	}

	function handleTabInsert(
		event: React.KeyboardEvent<HTMLTextAreaElement>,
		field: "thesis" | "conclusion" | "paragraphs",
		paragraphIndex?: number,
	) {
		if (event.key !== "Tab") {
			return;
		}

		event.preventDefault();
		const textarea = event.currentTarget;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const nextValue = `${textarea.value.slice(0, start)}\t${textarea.value.slice(end)}`;

		setDraft((previous) => {
			if (field === "paragraphs") {
				if (typeof paragraphIndex !== "number") {
					return previous;
				}

				return {
					...previous,
					paragraphs: previous.paragraphs.map((item, index) =>
						index === paragraphIndex ? { ...item, content: nextValue } : item,
					),
				};
			}

			return {
				...previous,
				[field]: nextValue,
			};
		});

		requestAnimationFrame(() => {
			textarea.selectionStart = start + 1;
			textarea.selectionEnd = start + 1;
		});
	}

	async function submitDraft(
		event: FormEvent<HTMLFormElement>,
		submissionPassword: string,
	) {
		event.preventDefault();
		const title = draft.title.trim();
		const location = draft.location.trim();
		const thesis = draft.thesis.trim();
		const paragraphs = draft.paragraphs
			.map((paragraph) => ({
				title: paragraph.title.trim(),
				content: paragraph.content.trim(),
			}))
			.filter((paragraph) => paragraph.content);
		const paragraphTitles = paragraphs.map((paragraph) => paragraph.title);
		const conclusion = draft.conclusion.trim();
		const content = [
			thesis,
			...paragraphs.map((paragraph) => paragraph.content),
			conclusion,
		]
			.filter(Boolean)
			.join("\n\n");
		const tags = parseTags(draft.tags);
		const sources = draft.sources.map(formatSourceCitation).filter(Boolean);

		if (!title) {
			setComposerError("Title is required.");
			return;
		}
		if (!draft.date) {
			setComposerError("Date is required.");
			return;
		}
		if (tags.length === 0) {
			setComposerError("At least one hashtag is required.");
			return;
		}
		if (tags.length > MAX_TAGS) {
			setComposerError(`Please use at most ${MAX_TAGS} hashtags.`);
			return;
		}
		if (tags.some((tag) => tag.length > MAX_SINGLE_TAG)) {
			setComposerError(
				`Each hashtag must be ${MAX_SINGLE_TAG} characters or fewer.`,
			);
			return;
		}
		if (!thesis) {
			setComposerError("A thesis paragraph is required.");
			return;
		}
		if (!conclusion) {
			setComposerError("A conclusion paragraph is required.");
			return;
		}
		if (!editingId || editingSource === "sanity") {
			if (!submissionPassword) {
				setComposerError("Enter the submission password.");
				return;
			}

			setIsSubmittingPost(true);
			setComposerError(null);
			try {
				const response = await fetch("/api/post-submissions", {
					method: editingId ? "PUT" : "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${submissionPassword}`,
					},
					body: JSON.stringify({
						...(editingId ? { id: editingId } : {}),
						title,
						date: draft.date,
						location,
						category: draft.category,
						tags,
						thesis,
						paragraphs,
						conclusion,
						sources,
					}),
				});

				if (!response.ok) {
					const result = (await response.json().catch(() => ({}))) as {
						error?: string;
						details?: string[];
					};
					const details = result.details?.join(" ");
					throw new Error(
						details
							? `${result.error ?? "Unable to submit the post."} ${details}`
							: (result.error ?? "Unable to submit the post."),
					);
				}

				setSubmissionNotice(
					editingId
						? "Post updated."
						: "Submitted for review. It will appear in the graph after it is published.",
				);
				closeComposer();
				router.refresh();
			} catch (error) {
				setComposerError(
					error instanceof Error
						? error.message
						: "Unable to submit the post. Please try again.",
				);
			} finally {
				setIsSubmittingPost(false);
			}
			return;
		}

		const baseSlug = slugify(title) || `post-${Date.now()}`;
		const id = editingId ?? `${baseSlug}-${Date.now()}`;

		const nextPost: Post = {
			id,
			slug: id,
			title,
			date: draft.date,
			location: location || undefined,
			categories: [draft.category],
			tags,
			content,
			thesis,
			conclusion,
			sources,
			paragraphTitles,
		};

		const savedPost = normalizePost(nextPost);
		setUserPosts((previous) => [
			savedPost,
			...previous.filter((post) => post.id !== savedPost.id),
		]);
		setCategoryFilter(ALL_OPTION);
		setLocationFilter(ALL_OPTION);
		setYearFilter(ALL_OPTION);
		setSelectedId(savedPost.id);
		setComposerError(null);
		closeComposer();
	}

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}

		const svg = d3.select(svgRef.current);
		svg.selectAll("*").remove();
		svg.attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

		const canvas = svg.append("g");

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.5, 2.5])
			.on("zoom", (event) => {
				canvas.attr("transform", event.transform.toString());
			});

		svg.call(zoom);

		canvas
			.append("rect")
			.attr("width", WIDTH)
			.attr("height", HEIGHT)
			.attr("fill", "#000000");

		const linkSelection = canvas
			.append("g")
			.attr("stroke", "rgba(255, 255, 255, 0.9)")
			.attr("stroke-linecap", "round")
			.selectAll<SVGLineElement, GraphLink>("line")
			.data(links)
			.join("line")
			.attr("stroke-width", (link) => Math.max(1.5, link.weight * 0.8));

		const simulation = d3
			.forceSimulation(nodes)
			.force(
				"link",
				d3
					.forceLink<GraphNode, GraphLink>(links)
					.id((node) => node.id)
					.distance((link) => Math.max(120, 210 - (link.weight ?? 1) * 24))
					.strength(0.9),
			)
			.force("charge", d3.forceManyBody().strength(-260))
			.force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
			.force(
				"collision",
				d3.forceCollide<GraphNode>().radius(NODE_RADIUS + 14),
			);

		const nodeSelection = canvas
			.append("g")
			.selectAll<SVGGElement, GraphNode>("g")
			.data(nodes)
			.join("g")
			.attr("cursor", "pointer")
			.call(
				d3
					.drag<SVGGElement, GraphNode>()
					.on("start", (event, node) => {
						if (!event.active) {
							simulation.alphaTarget(0.3).restart();
						}
						node.fx = node.x ?? 0;
						node.fy = node.y ?? 0;
					})
					.on("drag", (event, node) => {
						node.fx = event.x;
						node.fy = event.y;
					})
					.on("end", (event, node) => {
						if (!event.active) {
							simulation.alphaTarget(0);
						}
						node.fx = null;
						node.fy = null;
					}),
			)
			.on("click", (_, node) => {
				setSelectedId(node.id);
			});

		nodeSelection
			.append("circle")
			.attr("r", NODE_RADIUS)
			.attr("fill", (node) => node.color)
			.attr("fill-opacity", 1)
			.attr("stroke", (node) =>
				node.id === selectedId ? "#000000" : "rgba(255, 255, 255, 0.7)",
			)
			.attr("stroke-width", (node) => (node.id === selectedId ? 4 : 1.5));

		const labelSelection = nodeSelection
			.append("text")
			.attr("text-anchor", "middle")
			.attr("fill", "#000000")
			.attr("stroke-width", 2)
			.attr("paint-order", "stroke")
			.attr("font-size", 11)
			.attr("font-weight", 700);

		labelSelection.each(function appendTitleLines(node) {
			const [firstLine, secondLine] = getNodeTitleLines(node.title);
			const text = d3.select(this);

			text
				.append("tspan")
				.attr("x", 0)
				.attr("dy", secondLine ? -4 : 4)
				.text(firstLine);
			if (secondLine) {
				text.append("tspan").attr("x", 0).attr("dy", 14).text(secondLine);
			}
		});

		nodeSelection
			.append("title")
			.text((node) => `${node.title} · ${node.location} · ${node.year}`);

		simulation.on("tick", () => {
			linkSelection
				.attr("x1", (link) => (link.source as GraphNode).x ?? 0)
				.attr("y1", (link) => (link.source as GraphNode).y ?? 0)
				.attr("x2", (link) => (link.target as GraphNode).x ?? 0)
				.attr("y2", (link) => (link.target as GraphNode).y ?? 0);

			nodeSelection.attr(
				"transform",
				(node) => `translate(${node.x ?? 0}, ${node.y ?? 0})`,
			);
		});

		return () => {
			simulation.stop();
			svg.on(".zoom", null);
		};
	}, [links, nodes, selectedId]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setSelectedId(null);
				setIsComposerOpen(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	return (
		<section className="relative h-screen w-screen overflow-hidden bg-black">
			{nodes.length > 0 ? (
				<svg
					ref={svgRef}
					className="h-full w-full"
					role="img"
					aria-label="Second brain graph showing post nodes color-coded by school category and connected when they share hashtags"
				/>
			) : (
				<div className="flex h-full w-full items-center justify-center text-center text-white/70">
					No posts match the current filters.
				</div>
			)}

			<GraphFilters
				categories={categories}
				locations={locations}
				years={years}
				categoryFilter={categoryFilter}
				locationFilter={locationFilter}
				yearFilter={yearFilter}
				setCategoryFilter={setCategoryFilter}
				setLocationFilter={setLocationFilter}
				setYearFilter={setYearFilter}
			/>

			<button
				type="button"
				onClick={() => {
					setIsComposerOpen(true);
					setComposerError(null);
					setSubmissionNotice(null);
				}}
				className="absolute bottom-6 right-6 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white bg-white text-3xl leading-none text-black shadow-lg shadow-white/20 transition hover:bg-black hover:text-white"
				aria-label="Add post"
			>
				+
			</button>

			{isComposerOpen ? (
				<PostComposer
					draft={draft}
					setDraft={setDraft}
					categories={SCHOOL_CATEGORIES}
					isEditing={editingId !== null}
					requiresPassword={editingId === null || editingSource === "sanity"}
					onSubmit={submitDraft}
					isSubmitting={isSubmittingPost}
					onClose={closeComposer}
					onTabInsert={handleTabInsert}
					composerError={composerError}
				/>
			) : null}

			{submissionNotice ? (
				<div
					role="status"
					className="absolute bottom-6 left-1/2 z-20 flex w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-4 rounded-xl border border-white/20 bg-black/95 px-4 py-3 text-sm text-white shadow-xl"
				>
					<span>{submissionNotice}</span>
					<button
						type="button"
						onClick={() => setSubmissionNotice(null)}
						className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-lg transition hover:bg-white hover:text-black"
						aria-label="Dismiss submission confirmation"
					>
						×
					</button>
				</div>
			) : null}

			{selectedPost ? (
				<SelectedPostDialog
					selectedPost={selectedPost}
					onClose={() => setSelectedId(null)}
					onDelete={deletePost}
					isDeleting={isDeletingPost}
					deleteError={deleteError}
					onEdit={(post) => {
						setSelectedId(null);
						openComposerForEdit(post);
					}}
					dateFormatter={dateFormatter}
				/>
			) : null}
		</section>
	);
}
