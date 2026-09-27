export type ParagraphDraft = {
	title: string;
	content: string;
};

export type SourceDraft = {
	author: string;
	title: string;
	platform: string;
	publisher: string;
	publicationDate: string;
	url: string;
};

export const emptySourceDraft: SourceDraft = {
	author: "",
	title: "",
	platform: "",
	publisher: "",
	publicationDate: "",
	url: "",
};

export function formatSourceCitation(source: SourceDraft): string {
	const author = source.author.trim();
	const title = source.title.trim();
	const details = [
		source.platform.trim() ? `*${source.platform.trim()}*` : "",
		source.publisher.trim(),
		source.publicationDate.trim(),
		source.url.trim(),
	].filter(Boolean);

	return [
		author ? `${author}.` : "",
		title ? `\"${title}.\"` : "",
		details.length > 0 ? `${details.join(", ")}.` : "",
	]
		.filter(Boolean)
		.join(" ");
}

export function parseSourceCitation(citation: string): SourceDraft {
	const match = citation.match(/^(.*?)\.\s+\"([^\"]+)\.\"(?:\s+(.*))?$/);
	if (!match) {
		return { ...emptySourceDraft, title: citation.trim() };
	}

	let details = match[3] ?? "";
	const containerMatch = details.match(/^\*([^*]+)\*\s*,?\s*/);
	const platform = containerMatch?.[1] ?? "";
	if (containerMatch) {
		details = details.slice(containerMatch[0].length);
	}

	const urlMatch = details.match(/(?:^|,\s*)(https?:\/\/\S+)\.?$/);
	const url = urlMatch?.[1] ?? "";
	if (urlMatch) {
		details = details.slice(0, urlMatch.index).replace(/,\s*$/, "");
	}

	const detailParts = details
		.split(/,\s*/)
		.map((part) => part.trim())
		.filter(Boolean);
	const dateIndex = detailParts.findIndex((part) => /\b\d{4}\b/.test(part));
	const publicationDate = dateIndex >= 0 ? detailParts[dateIndex] : "";
	const publisher = detailParts
		.filter((_, index) => index !== dateIndex)
		.join(", ");

	return {
		author: match[1],
		title: match[2],
		platform,
		publisher,
		publicationDate,
		url,
	};
}

export type PostDraft = {
	title: string;
	category: string;
	location: string;
	date: string;
	tags: string;
	thesis: string;
	paragraphs: ParagraphDraft[];
	conclusion: string;
	sources: SourceDraft[];
};
