type PostMetricSeed = Pick<{
  total_likes?: number;
  total_comments?: number;
  product_id?: string;
}, 'total_likes' | 'total_comments' | 'product_id'>;

export function estimatePostImpressions(post: PostMetricSeed) {
  const likes = post.total_likes ?? 0;
  const comments = post.total_comments ?? 0;
  return likes * 8 + comments * 15 + 42;
}

export function estimatePostSaves(post: PostMetricSeed) {
  const likes = post.total_likes ?? 0;
  const comments = post.total_comments ?? 0;
  return Math.max(0, Math.round(likes * 0.18 + comments * 0.4));
}

export function estimateChatsInitiated(post: PostMetricSeed) {
  const comments = post.total_comments ?? 0;
  const productBoost = post.product_id ? 2 : 0;
  return Math.max(0, Math.round(comments * 0.35) + productBoost);
}
