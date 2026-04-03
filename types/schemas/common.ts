import { z } from "zod";

// Shared types
export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;

export const Visibility = z.enum(["public", "private"]);
export type Visibility = z.infer<typeof Visibility>;

export const FriendshipStatus = z.enum(["none", "pending", "accepted", "blocked"]);
export type FriendshipStatus = z.infer<typeof FriendshipStatus>;

export const MediaMimeType = z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]);
export type MediaMimeType = z.infer<typeof MediaMimeType>;
