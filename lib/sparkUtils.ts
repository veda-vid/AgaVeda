/** Synthetic Spark ids prefix video posts from the home feed as Sparks. */
export const POST_SPARK_PREFIX = 'post-spark-';

export type SparkBackendRef =
  | { kind: 'reel'; id: string }
  | { kind: 'post'; id: string };

export function resolveSparkBackendRef(sparkId: string): SparkBackendRef | null {
  if (sparkId.startsWith(POST_SPARK_PREFIX)) {
    const postId = sparkId.slice(POST_SPARK_PREFIX.length);
    return postId ? { kind: 'post', id: postId } : null;
  }
  return sparkId ? { kind: 'reel', id: sparkId } : null;
}

export type SparkHydrationSeed = {
  id: string;
  total_likes?: number;
  total_comments?: number;
  total_reposts?: number;
  is_liked?: boolean;
  is_reposted?: boolean;
  is_following?: boolean;
};
