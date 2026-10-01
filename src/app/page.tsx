import { SecondBrainGraph } from "../components/second-brain-graph";
import { getAllPosts } from "@/lib/posts";
import { getPublishedSanityPosts } from "@/sanity/lib/posts";

export const revalidate = 60;

export default async function Home() {
  const [mdxPosts, sanityPosts] = await Promise.all([
    getAllPosts(),
    getPublishedSanityPosts(),
  ]);

  return <SecondBrainGraph posts={[...mdxPosts, ...sanityPosts]} />;
}
