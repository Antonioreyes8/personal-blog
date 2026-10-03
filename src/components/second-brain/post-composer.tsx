import type {
	Dispatch,
	FormEvent,
	KeyboardEvent as ReactKeyboardEvent,
	PointerEvent as ReactPointerEvent,
	SetStateAction,
} from "react";
import { Fragment, useRef, useState } from "react";

import type { PostDraft } from "./types";
import { emptySourceDraft } from "./types";

type PostComposerProps = {
	draft: PostDraft;
	setDraft: Dispatch<SetStateAction<PostDraft>>;
	categories: readonly string[];
	isEditing: boolean;
	onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
	isSubmitting: boolean;
	onClose: () => void;
	onTabInsert: (
		event: ReactKeyboardEvent<HTMLTextAreaElement>,
		field: "thesis" | "conclusion" | "paragraphs",
		paragraphIndex?: number,
	) => void;
	composerError: string | null;
};

export function PostComposer({
	draft,
	setDraft,
	categories,
	isEditing,
	onSubmit,
	isSubmitting,
	onClose,
	onTabInsert,
	composerError,
}: PostComposerProps) {
	const backdropPointerDown = useRef(false);
	const paragraphListRef = useRef<HTMLDivElement>(null);
	const paragraphDrag = useRef<{
		pointerId: number;
		from: number;
		to: number;
	} | null>(null);
	const [draggingParagraphIndex, setDraggingParagraphIndex] = useState<
		number | null
	>(null);
	const [paragraphDropIndex, setParagraphDropIndex] = useState<number | null>(
		null,
	);
	const [paragraphAnnouncement, setParagraphAnnouncement] = useState("");

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		await onSubmit(event);
	}

	const updateParagraph = (
		index: number,
		field: "title" | "content",
		value: string,
	) => {
		setDraft((previous) => ({
			...previous,
			paragraphs: previous.paragraphs.map((item, itemIndex) =>
				itemIndex === index ? { ...item, [field]: value } : item,
			),
		}));
	};

	const addParagraph = () => {
		setDraft((previous) => ({
			...previous,
			paragraphs: [...previous.paragraphs, { title: "", content: "" }],
		}));
	};

	const removeParagraph = (index: number) => {
		setDraft((previous) => ({
			...previous,
			paragraphs: previous.paragraphs.filter(
				(_, itemIndex) => itemIndex !== index,
			),
		}));
	};

	const moveParagraph = (from: number, to: number) => {
		setDraft((previous) => {
			if (
				from < 0 ||
				from >= previous.paragraphs.length ||
				to < 0 ||
				to >= previous.paragraphs.length ||
				from === to
			) {
				return previous;
			}

			const paragraphs = [...previous.paragraphs];
			const [movedParagraph] = paragraphs.splice(from, 1);
			if (!movedParagraph) {
				return previous;
			}
			paragraphs.splice(to, 0, movedParagraph);

			return { ...previous, paragraphs };
		});
		setParagraphAnnouncement(
			`Paragraph ${from + 1} moved to position ${to + 1}.`,
		);
	};

	const startParagraphDrag = (
		index: number,
		event: ReactPointerEvent<HTMLButtonElement>,
	) => {
		if (!event.isPrimary || event.button !== 0) {
			return;
		}

		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		paragraphDrag.current = {
			pointerId: event.pointerId,
			from: index,
			to: index,
		};
		setDraggingParagraphIndex(index);
		setParagraphDropIndex(index);
	};

	const updateParagraphDropTarget = (
		event: ReactPointerEvent<HTMLButtonElement>,
	) => {
		const drag = paragraphDrag.current;
		if (!drag || drag.pointerId !== event.pointerId) {
			return;
		}

		const rows = Array.from(
			paragraphListRef.current?.querySelectorAll<HTMLElement>(
				"[data-paragraph-index]",
			) ?? [],
		);
		const target = rows.find((row) => {
			const bounds = row.getBoundingClientRect();
			return event.clientY < bounds.top + bounds.height / 2;
		});
		const nextIndex = target
			? Number(target.dataset.paragraphIndex)
			: rows.length;

		drag.to = nextIndex;
		setParagraphDropIndex(nextIndex);
	};

	const finishParagraphDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
		updateParagraphDropTarget(event);
		const drag = paragraphDrag.current;
		if (!drag || drag.pointerId !== event.pointerId) {
			return;
		}

		const targetIndex = drag.to > drag.from ? drag.to - 1 : drag.to;
		if (targetIndex !== drag.from) {
			moveParagraph(drag.from, targetIndex);
		}
		paragraphDrag.current = null;
		setDraggingParagraphIndex(null);
		setParagraphDropIndex(null);
	};

	const cancelParagraphDrag = () => {
		paragraphDrag.current = null;
		setDraggingParagraphIndex(null);
		setParagraphDropIndex(null);
	};

	const handleParagraphKeyDown = (
		index: number,
		event: ReactKeyboardEvent<HTMLButtonElement>,
	) => {
		const direction =
			event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
		if (!direction) {
			return;
		}

		event.preventDefault();
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= draft.paragraphs.length) {
			return;
		}

		moveParagraph(index, targetIndex);
	};

	const updateSource = (
		index: number,
		field: keyof (typeof draft.sources)[number],
		value: string,
	) => {
		setDraft((previous) => ({
			...previous,
			sources: previous.sources.map((source, sourceIndex) =>
				sourceIndex === index ? { ...source, [field]: value } : source,
			),
		}));
	};

	return (
		<div
			className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
			onPointerDown={(event) => {
				backdropPointerDown.current = event.target === event.currentTarget;
			}}
			onClick={(event) => {
				if (
					backdropPointerDown.current &&
					event.target === event.currentTarget
				) {
					onClose();
				}
				backdropPointerDown.current = false;
			}}
		>
			<form
				onSubmit={handleSubmit}
				className="max-h-[92vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-4xl border border-white/15 bg-black/95 p-6 text-white shadow-2xl shadow-white/10 sm:p-8"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4">
					<h2 className="text-2xl font-semibold text-white">
						{isEditing ? "Edit post" : "Add post"}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl text-white transition hover:bg-white hover:text-black"
						aria-label="Close post form"
					>
						×
					</button>
				</div>

				<label className="flex flex-col gap-2 text-sm text-white">
					Title
					<input
						value={draft.title}
						onChange={(event) =>
							setDraft((previous) => ({
								...previous,
								title: event.target.value,
							}))
						}
						maxLength={90}
						required
						className="rounded-2xl border border-white/15 bg-black pl-4 pr-10 py-3 text-white outline-none"
					/>
				</label>

				<div className="grid gap-4 sm:grid-cols-2">
					<label className="flex flex-col gap-2 text-sm text-white">
						Category
						<select
							value={draft.category}
							onChange={(event) =>
								setDraft((previous) => ({
									...previous,
									category: event.target.value,
								}))
							}
							className="rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none"
						>
							{categories.map((category) => (
								<option key={category} value={category}>
									{category}
								</option>
							))}
						</select>
					</label>

					<label className="flex flex-col gap-2 text-sm text-white">
						Date
						<input
							type="date"
							value={draft.date}
							onChange={(event) =>
								setDraft((previous) => ({
									...previous,
									date: event.target.value,
								}))
							}
							required
							className="rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none"
						/>
					</label>
				</div>

				<label className="flex flex-col gap-2 text-sm text-white">
					Location
					<input
						value={draft.location}
						onChange={(event) =>
							setDraft((previous) => ({
								...previous,
								location: event.target.value,
							}))
						}
						maxLength={60}
						required
						className="rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none"
					/>
				</label>

				<label className="flex flex-col gap-2 text-sm text-white">
					Hashtags (comma separated, letters/numbers/hyphens)
					<input
						value={draft.tags}
						onChange={(event) =>
							setDraft((previous) => ({
								...previous,
								tags: event.target.value,
							}))
						}
						maxLength={120}
						required
						placeholder="graph, learning, geometry"
						className="rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none"
					/>
				</label>

				<div className="border-t border-white/15 pt-4">
					<h3 className="text-lg font-semibold text-white">Writing Studio</h3>
					<p className="mt-1 text-sm text-white/70">
						Use these fields to develop the argument behind your post.
					</p>
				</div>

				<label className="flex flex-col gap-2 text-sm text-white">
					Thesis paragraph
					<textarea
						value={draft.thesis}
						onChange={(event) =>
							setDraft((previous) => ({
								...previous,
								thesis: event.target.value,
							}))
						}
						onKeyDown={(event) => onTabInsert(event, "thesis")}
						rows={5}
						placeholder="Write the central argument of the post"
						className="rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none"
					/>
				</label>

				<div
					ref={paragraphListRef}
					className="flex flex-col gap-3 text-sm text-white"
				>
					<span>Paragraphs</span>
					<p id="paragraph-reorder-help" className="sr-only">
						Drag a paragraph handle to reorder it, or focus the handle and use
						the arrow keys.
					</p>
					<p aria-live="polite" className="sr-only">
						{paragraphAnnouncement}
					</p>
					{draft.paragraphs.map((paragraph, index) => (
						<Fragment key={index}>
							<div className="relative">
								{draggingParagraphIndex !== null &&
								paragraphDropIndex === index ? (
									<div
										aria-hidden="true"
										className="pointer-events-none absolute inset-x-2 -top-2 z-10 h-0.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
									/>
								) : null}
								<div
									data-paragraph-index={index}
									className={`flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/3 p-3 ${draggingParagraphIndex === index ? "opacity-50" : ""}`}
								>
									<div className="flex items-center gap-2">
										<button
											type="button"
											aria-label={`Reorder paragraph ${index + 1}`}
											aria-describedby="paragraph-reorder-help"
											title="Drag to reorder, or use the arrow keys"
											onPointerDown={(event) =>
												startParagraphDrag(index, event)
											}
											onPointerMove={updateParagraphDropTarget}
											onPointerUp={finishParagraphDrag}
											onPointerCancel={cancelParagraphDrag}
											onLostPointerCapture={cancelParagraphDrag}
											onKeyDown={(event) =>
												handleParagraphKeyDown(index, event)
											}
											className="inline-flex h-10 w-10 shrink-0 touch-none cursor-grab items-center justify-center rounded-xl border border-white/15 text-lg text-white/70 transition hover:bg-white/10 hover:text-white active:cursor-grabbing"
										>
											↕
										</button>
										<input
											value={paragraph.title}
											onChange={(event) =>
												updateParagraph(index, "title", event.target.value)
											}
											placeholder="Section heading (optional)"
											aria-label={`Heading for paragraph ${index + 1}`}
											className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none"
										/>
									</div>

									<div className="flex items-start gap-2">
										<textarea
											value={paragraph.content}
											onChange={(event) =>
												updateParagraph(index, "content", event.target.value)
											}
											onKeyDown={(event) =>
												onTabInsert(event, "paragraphs", index)
											}
											rows={4}
											placeholder={`Paragraph ${index + 1}`}
											className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none"
										/>
										{draft.paragraphs.length > 1 ? (
											<button
												type="button"
												onClick={() => removeParagraph(index)}
												className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white hover:text-black"
												aria-label={`Remove paragraph ${index + 1}`}
											>
												×
											</button>
										) : null}
									</div>
								</div>
								{draggingParagraphIndex !== null &&
								paragraphDropIndex === index + 1 &&
								index === draft.paragraphs.length - 1 ? (
									<div
										aria-hidden="true"
										className="pointer-events-none absolute inset-x-2 -bottom-2 z-10 h-0.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
									/>
								) : null}
							</div>
						</Fragment>
					))}
					<button
						type="button"
						onClick={addParagraph}
						className="self-start rounded-full border border-white/30 px-4 py-2 text-xs text-white transition hover:bg-white hover:text-black"
					>
						Add another paragraph
					</button>
				</div>

				<label className="flex flex-col gap-2 text-sm text-white">
					Conclusion paragraph
					<textarea
						value={draft.conclusion}
						onChange={(event) =>
							setDraft((previous) => ({
								...previous,
								conclusion: event.target.value,
							}))
						}
						onKeyDown={(event) => onTabInsert(event, "conclusion")}
						rows={4}
						placeholder="Summarize the takeaway"
						className="rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none"
					/>
				</label>

				<div className="flex flex-col gap-3 text-sm text-white">
					<span>Sources cited</span>
					{draft.sources.map((source, index) => (
						<div key={index} className="flex items-start gap-2">
							<div className="min-w-0 flex-1">
								<h4 className="mb-2 text-sm font-semibold text-white">
									Source {index + 1}
								</h4>
								<div className="grid gap-3 sm:grid-cols-2">
									{(
										[
											["author", "Author Last Name, First Name"],
											["title", "Title of Source"],
											["platform", "Platform"],
											["publisher", "Publisher"],
											["publicationDate", "Publication Date"],
											["url", "URL"],
										] as const
									).map(([field, label]) => {
										const hasCitationDetails = Object.values(source).some(
											(value) => value.trim(),
										);
										return (
											<label
												key={field}
												className="flex flex-col gap-1 text-xs text-white/70"
											>
												<input
													value={source[field]}
													onChange={(event) =>
														updateSource(index, field, event.target.value)
													}
													required={
														hasCitationDetails &&
														(field === "author" || field === "title")
													}
													placeholder={label}
													className="min-w-0 rounded-xl border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none"
												/>
											</label>
										);
									})}
								</div>
							</div>
							{draft.sources.length > 1 ? (
								<button
									type="button"
									onClick={() =>
										setDraft((previous) => ({
											...previous,
											sources: previous.sources.filter(
												(_, itemIndex) => itemIndex !== index,
											),
										}))
									}
									className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white hover:text-black"
									aria-label={`Remove source ${index + 1}`}
								>
									×
								</button>
							) : null}
						</div>
					))}
					<button
						type="button"
						onClick={() =>
							setDraft((previous) => ({
								...previous,
								sources: [...previous.sources, { ...emptySourceDraft }],
							}))
						}
						className="self-start rounded-full border border-white/30 px-4 py-2 text-xs text-white transition hover:bg-white hover:text-black"
					>
						Add another source
					</button>
				</div>

				{composerError ? (
					<p className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white">
						{composerError}
					</p>
				) : null}

				<div className="flex justify-end">
					<button
						type="submit"
						disabled={isSubmitting}
						className="rounded-full border border-white bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black hover:text-white"
					>
						{isEditing
							? "Save changes"
							: isSubmitting
								? "Submitting…"
								: "Submit for review"}
					</button>
				</div>
			</form>
		</div>
	);
}
