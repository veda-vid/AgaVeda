// lib/storyGroups.ts — Instagram-style story rings (one ring per owner, many pages)

import type { Story } from '../types';

export type StoryGroup = {
  key: string;
  author_id: string;
  shop_id: string | null;
  service_provider_id?: string | null;
  shop_name: string;
  shop_logo: string | null;
  items: Story[];
};

function ownerKey(story: Story) {
  if (story.shop_id) return `shop:${story.shop_id}`;
  if (story.service_provider_id) return `pro:${story.service_provider_id}`;
  return `author:${story.author_id}`;
}

/** Group flat story rows into Instagram-style rings (newest page first within each ring). */
export function groupStories(stories: Story[]): StoryGroup[] {
  const map = new Map<string, StoryGroup>();
  const order: string[] = [];

  for (const story of stories ?? []) {
    if (!story?.id || !story?.media_url || story.deleted_at) continue;
    const key = ownerKey(story);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        author_id: story.author_id,
        shop_id: story.shop_id ?? null,
        service_provider_id: story.service_provider_id ?? null,
        shop_name: story.shop_name?.trim() || 'Shop',
        shop_logo: story.shop_logo ?? null,
        items: [story],
      });
      order.push(key);
      continue;
    }
    existing.items.push(story);
    if (!existing.shop_name && story.shop_name) existing.shop_name = story.shop_name;
    if (!existing.shop_logo && story.shop_logo) existing.shop_logo = story.shop_logo;
  }

  for (const group of map.values()) {
    // Instagram: pages play oldest → newest within a ring.
    group.items.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }

  // Ring rail order: most recently active owner first.
  return order
    .map(k => map.get(k)!)
    .filter(Boolean)
    .sort((a, b) => {
      const aLatest = a.items[a.items.length - 1]?.created_at ?? '';
      const bLatest = b.items[b.items.length - 1]?.created_at ?? '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });
}

export function findStoryGroup(
  stories: Story[],
  target: Story | string | null | undefined,
): { group: StoryGroup; startIndex: number } | null {
  if (!target) return null;
  const id = typeof target === 'string' ? target : target.id;
  const groups = groupStories(stories);
  for (const group of groups) {
    const startIndex = group.items.findIndex(s => s.id === id);
    if (startIndex >= 0) return { group, startIndex };
  }
  return null;
}

export function ownStoryGroup(
  stories: Story[],
  userId?: string | null,
  shopId?: string | null,
): StoryGroup | null {
  if (!userId && !shopId) return null;
  const groups = groupStories(stories);
  return (
    groups.find(g =>
      (shopId && g.shop_id === shopId)
      || (userId && g.author_id === userId),
    ) ?? null
  );
}
