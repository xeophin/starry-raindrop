import axios from "axios";
import _ from "lodash";
import { Octokit } from "octokit";

const raindropAxios = axios.create({
	baseURL: "https://api.raindrop.io/rest/v1",
	headers: {
		Authorization: `Bearer ${process.env.RAINDROP_TOKEN}`,
		"Content-Type": "application/json",
	},
});

export type StarredRepo = {
  full_name: string;
  html_url: string;
  language: string | null;
  topics?: string[];
  description: string | null;
};

export type ActualStar = {
  starred_at: string;
  repo: StarredRepo;
};

export type RaindropItem = {
  collectionId: string | undefined;
  title: string;
  link: string;
  tags: string[];
  created: string;
  excerpt: string | null;
};

export function mapStarToRaindrop(
  star: ActualStar,
  collectionId: string | undefined
): RaindropItem {
  return {
    collectionId,
    title: star.repo.full_name,
    link: star.repo.html_url,
    tags: _([
      "github",
      star.repo.language || undefined,
      ...(star.repo.topics || []),
    ])
      .compact()
      .map((i) => i.toLowerCase())
      .value(),
    created: star.starred_at,
    excerpt: star.repo.description,
  };
}

export function filterNewRaindrops(
  chunk: RaindropItem[],
  duplicates: { link: string }[]
): RaindropItem[] {
  return chunk.filter((r) => duplicates.every((d) => d.link !== r.link));
}

export const main = async () => {
	const octokit = new Octokit({ auth: process.env.GH_TOKEN });

	console.log(new Date(), "Fetching all your starred repos...");
	const stars = await octokit.paginate(octokit.rest.activity.listReposStarredByAuthenticatedUser, {
		per_page: 100,
		headers: {
			// Required to get the `starred_at` property
			// https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user
			accept: "application/vnd.github.v3.star+json",
		},
	});
	console.log(new Date(), `Found ${stars.length} starred repos!`);

	const newRaindrops = (stars as unknown as ActualStar[]).map((star) =>
		mapStarToRaindrop(star, process.env.RAINDROP_COLLECTION_ID)
	);
	const chunks = _.chunk(newRaindrops, 100);

	console.log(new Date(), `Looping through chunks of 100 repos...`);
	for (const chunk of chunks) {
		const existingUrlsRes = await raindropAxios.post("/import/url/exists", {
			urls: chunk.map((s) => s.link),
		});
		const existingUrls = existingUrlsRes.data;
		const toImport = filterNewRaindrops(chunk, existingUrls.duplicates);
		if (toImport.length > 0) {
			await raindropAxios.post("/raindrops", {
				items: toImport,
			});
			console.log(new Date(), `Added ${toImport.length} stars to Raindrop`);
		} else {
			console.log(new Date(), `Skipped chunk (${chunk.length} repos)`);
		}
	}
};
