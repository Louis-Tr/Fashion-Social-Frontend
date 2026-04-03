import {z} from "zod";

export const ReactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  postId: z.string(),
  createdAt: z.string(),
});

export type Reaction = z.infer<typeof ReactionSchema>;