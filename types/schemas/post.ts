import {z} from "zod";
import {UserSchema} from "./user";

export const PostSchema = z.object({
  id: z.string(),
  userInfo: UserSchema,
  caption: z.string().nullable(),
  reactions: z.number(),
  mediaUrls: z.array(z.string()),
  createdAt: z.string(),
});

export type Post = z.infer<typeof PostSchema>;