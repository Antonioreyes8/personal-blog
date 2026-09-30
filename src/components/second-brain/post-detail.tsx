import type { Post } from "@/lib/posts";

type SelectedPostDialogProps = {
	selectedPost: Post;
	onClose: () => void;
	onEdit: (post: Post) => void;
	onDelete: (post: Post) => void;
	isDeleting: boolean;
	deleteError: string | null;
	dateFormatter: Intl.DateTimeFormat;
};

export function SelectedPostDialog({
	selectedPost,
	onClose,
	onEdit,
	onDelete,
	isDeleting,
	deleteError,
	dateFormatter,
}: SelectedPostDialogProps) {
	return (
		<div
			className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
			onClick={onClose}
		>
			<article
				role="dialog"
				aria-modal="true"
				aria-labelledby="selected-post-title"
				className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-4xl border border-white/15 bg-black/95 p-6 text-white shadow-2xl shadow-white/10 sm:p-8"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						{selectedPost.location ? (
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
								{selectedPost.location} ·{" "}
								{dateFormatter.format(new Date(selectedPost.date))}
							</p>
						) : (
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
								{dateFormatter.format(new Date(selectedPost.date))}
							</p>
						)}
						<h2
							id="selected-post-title"
							className="mt-3 text-3xl font-semibold tracking-tight text-balance text-white"
						>
							{selectedPost.title}
						</h2>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							disabled={isDeleting}
							onClick={() => {
								if (
									window.confirm(
										`Delete “${selectedPost.title}”? This cannot be undone.`,
									)
								) {
									onDelete(selectedPost);
								}
							}}
							className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/25 disabled:cursor-wait disabled:opacity-50"
						>
							{isDeleting ? "Deleting…" : "Delete"}
						</button>
						<button
							type="button"
							onClick={() => onEdit(selectedPost)}
							className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white hover:text-black"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={onClose}
							className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl text-white transition hover:bg-white hover:text-black"
							aria-label="Close post"
						>
							×
						</button>
					</div>
				</div>
				{deleteError ? (
					<p role="alert" className="mt-4 text-sm text-red-300">
						{deleteError}
					</p>
				) : null}

				<div className="mt-5 flex flex-wrap gap-2">
					{selectedPost.categories.map((category) => (
						<span
							key={category}
							className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-white"
						>
							{category}
						</span>
					))}
					{selectedPost.tags.map((tag) => (
						<span
							key={tag}
							className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white"
						>
							#{tag}
						</span>
					))}
				</div>

				<div className="mt-8 text-base leading-8 text-white/85">
					{selectedPost.paragraphTitles !== undefined && selectedPost.thesis ? (
						<p className="whitespace-pre-wrap">{selectedPost.thesis}</p>
					) : null}
					{selectedPost.paragraphTitles !== undefined &&
						selectedPost.paragraphTitles.map((title, index) => {
							const paragraphs = selectedPost.content
								.replace(selectedPost.thesis ?? "", "")
								.replace(selectedPost.conclusion ?? "", "")
								.split(/\n\s*\n/)
								.map((paragraph) => paragraph.trim())
								.filter(Boolean);
							const paragraph = paragraphs[index];

							if (!paragraph) {
								return null;
							}

							return (
								<section key={`${title}-${index}`} className="mt-6">
									{title ? (
										<h3 className="mb-2 text-xl font-semibold text-white">
											{title}
										</h3>
									) : null}
									<p className="whitespace-pre-wrap">{paragraph}</p>
								</section>
							);
						})}
					{selectedPost.paragraphTitles === undefined ? (
						<p className="whitespace-pre-wrap">{selectedPost.content}</p>
					) : null}
					{selectedPost.paragraphTitles !== undefined &&
					selectedPost.conclusion ? (
						<p className="mt-6 whitespace-pre-wrap">
							{selectedPost.conclusion}
						</p>
					) : null}
					{selectedPost.sources && selectedPost.sources.length > 0 ? (
						<div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
								Sources cited
							</p>
							<ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-7 text-white/90">
								{selectedPost.sources.map((source) => (
									<li key={source}>
										{source
											.split(/(\*[^*]+\*)/g)
											.map((part, index) =>
												part.startsWith("*") && part.endsWith("*") ? (
													<em key={index}>{part.slice(1, -1)}</em>
												) : (
													part
												),
											)}
									</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
			</article>
		</div>
	);
}
