import {z} from "zod";

export const CommentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  postId: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  reactions: z.number(),
  createdAt: z.string()
});

export type Comment = z.infer<typeof CommentSchema>;