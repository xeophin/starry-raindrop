import { describe, it, expect } from "vitest";
import { mapStarToRaindrop, filterNewRaindrops } from "../main.js";
import type { ActualStar, RaindropItem } from "../main.js";

const makeRepo = (
	overrides: Partial<{
		full_name: string;
		html_url: string;
		language: string | null;
		topics: string[];
		description: string | null;
	}> = {},
) => ({
	full_name: "owner/repo",
	html_url: "https://github.com/owner/repo",
	language: "TypeScript",
	topics: ["tooling"],
	description: "A great repo",
	...overrides,
});

const makeStar = (repoOverrides: Parameters<typeof makeRepo>[0] = {}): ActualStar => ({
	starred_at: "2024-01-01T00:00:00Z",
	repo: makeRepo(repoOverrides),
});

describe("mapStarToRaindrop", () => {
	it("maps all fields correctly", () => {
		const result = mapStarToRaindrop(makeStar(), "12345");
		expect(result).toEqual({
			collectionId: "12345",
			title: "owner/repo",
			link: "https://github.com/owner/repo",
			tags: ["github", "typescript", "tooling"],
			created: "2024-01-01T00:00:00Z",
			excerpt: "A great repo",
		});
	});

	it("excludes null language from tags", () => {
		const result = mapStarToRaindrop(makeStar({ language: null }), "12345");
		expect(result.tags).toEqual(["github", "tooling"]);
	});

	it("handles empty topics", () => {
		const result = mapStarToRaindrop(makeStar({ topics: [] }), "12345");
		expect(result.tags).toEqual(["github", "typescript"]);
	});

	it("lowercases all tags", () => {
		const result = mapStarToRaindrop(
			makeStar({ language: "TypeScript", topics: ["MyTopic"] }),
			"12345",
		);
		expect(result.tags).toEqual(["github", "typescript", "mytopic"]);
	});

	it("produces only github tag when language is null and topics is empty", () => {
		const result = mapStarToRaindrop(makeStar({ language: null, topics: [] }), "12345");
		expect(result.tags).toEqual(["github"]);
	});

	it("passes string collectionId through", () => {
		expect(mapStarToRaindrop(makeStar(), "my-collection").collectionId).toBe("my-collection");
	});

	it("passes undefined collectionId through", () => {
		expect(mapStarToRaindrop(makeStar(), undefined).collectionId).toBeUndefined();
	});
});

describe("filterNewRaindrops", () => {
	const item = (link: string): RaindropItem => ({
		collectionId: "1",
		title: "title",
		link,
		tags: [],
		created: "",
		excerpt: null,
	});

	it("returns all items when duplicates list is empty", () => {
		const chunk = [item("https://a.com"), item("https://b.com")];
		expect(filterNewRaindrops(chunk, [])).toEqual(chunk);
	});

	it("excludes items matching a duplicate link", () => {
		const chunk = [item("https://a.com"), item("https://b.com")];
		const result = filterNewRaindrops(chunk, [{ link: "https://a.com" }]);
		expect(result).toEqual([item("https://b.com")]);
	});

	it("returns empty array when all items are duplicates", () => {
		const chunk = [item("https://a.com"), item("https://b.com")];
		const result = filterNewRaindrops(chunk, [
			{ link: "https://a.com" },
			{ link: "https://b.com" },
		]);
		expect(result).toEqual([]);
	});

	it("handles partial overlap correctly", () => {
		const chunk = [item("https://a.com"), item("https://b.com"), item("https://c.com")];
		const result = filterNewRaindrops(chunk, [{ link: "https://b.com" }]);
		expect(result).toEqual([item("https://a.com"), item("https://c.com")]);
	});
});
