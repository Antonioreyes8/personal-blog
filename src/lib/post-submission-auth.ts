import { timingSafeEqual } from "node:crypto";

export function isAuthorizedPostMutation(request: Request): boolean {
	const expectedPassword = process.env.POST_SUBMISSION_PASSWORD;
	if (!expectedPassword || expectedPassword.length < 16) {
		return false;
	}

	const authorization = request.headers.get("authorization");
	const providedPassword = authorization?.startsWith("Bearer ")
		? authorization.slice("Bearer ".length)
		: "";
	const expectedBytes = Buffer.from(expectedPassword);
	const providedBytes = Buffer.from(providedPassword);

	return (
		providedBytes.length === expectedBytes.length &&
		timingSafeEqual(providedBytes, expectedBytes)
	);
}
