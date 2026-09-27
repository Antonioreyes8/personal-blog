import { SecondBrainGraph } from "../components/second-brain-graph";
import { getAllPosts } from "@/lib/posts";

export default async function Home() {
  const posts = await getAllPosts();

  return <SecondBrainGraph posts={posts} />;
}
