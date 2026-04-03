// src/services/wardrobe/schemas.ts
import { z } from 'zod'

export const UUID = z.string()
export const Visibility = z.enum(['public', 'private'])
export const ItemStatus = z.enum(['active', 'archived'])

/** ---------- domain ---------- */
export const CategorySchema = z.object({
  id: UUID,
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
})

export const StyleSchema = z.object({
  id: UUID,
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
})

export const CollectionSchema = z.object({
  id: UUID,
  userId: UUID,
  name: z.string(),
  description: z.string().nullable(),
  visibility: Visibility,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const WardrobeItemSchema = z.object({
  id: UUID,
  userId: UUID,
  name: z.string(),
  categoryId: UUID.nullable(),
  brand: z.string().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  material: z.string().nullable(),
  season: z.string().nullable(),
  notes: z.string().nullable(),
  visibility: Visibility,
  status: ItemStatus,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const ItemPhotoSchema = z.object({
  id: UUID,
  itemId: UUID,
  s3Key: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
})

export const CollectionMembershipSchema = z.object({
  collectionId: UUID,
  itemId: UUID,
  sortOrder: z.number().int(),
  createdAt: z.string(),
})

export const CollectionItemBundleSchema = z.object({
  membership: CollectionMembershipSchema,
  item: WardrobeItemSchema,
  category: CategorySchema.nullable().optional(),
  photos: z.array(ItemPhotoSchema).optional(),
  styles: z.array(StyleSchema).optional(),
})

export const CollectionWithItemsSchema = CollectionSchema.extend({
  items: z.array(CollectionItemBundleSchema).optional(),
})

export const WardrobeItemExpandedSchema = WardrobeItemSchema.extend({
  category: CategorySchema.nullable().optional(),
  photos: z.array(ItemPhotoSchema).optional(),
  styles: z.array(StyleSchema).optional(),
})

/** ---------- request schemas (validate before sending) ---------- */
export const CreateCollectionReq = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  visibility: Visibility.optional(),
})

export const UpdateCollectionReq = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  visibility: Visibility.optional(),
})

export const CreateWardrobeItemReq = z.object({
  name: z.string().min(1).max(160),
  category: z.string().max(160).nullable(), // frontend sends this
  brand: z.string().max(80).nullable(),
  color: z.string().max(80).nullable(),
  size: z.string().max(40).nullable(),
  material: z.string().max(80).nullable(),
  season: z.string().max(40).nullable(),
  notes: z.string().max(1000).nullable(),
  visibility: Visibility,
  mediaCount: z.number().int().min(0).optional().default(0),
})

export const UpdateWardrobeItemReq = z.object({
  name: z.string().min(1).max(160).optional(),
  categoryId: UUID.optional().nullable(),
  brand: z.string().max(80).optional().nullable(),
  color: z.string().max(80).optional().nullable(),
  size: z.string().max(40).optional().nullable(),
  material: z.string().max(80).optional().nullable(),
  season: z.string().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  visibility: Visibility.optional(),
  status: ItemStatus.optional(),
})

export const AddItemPhotoReq = z.object({
  s3Key: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
})

export const UpdateItemPhotoReq = z.object({
  sortOrder: z.number().int().min(0).optional(),
})

export const AddItemToCollectionReq = z.object({
  itemId: UUID,
  sortOrder: z.number().int().min(0).optional(),
})

export const UpdateCollectionItemReq = z.object({
  sortOrder: z.number().int().min(0),
})

export const AddStyleToItemReq = z.object({
  styleId: UUID,
})

export const CreateStyleReq = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
})

export const UpdateStyleReq = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
})

export const CreateCategoryReq = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
})

export const UpdateCategoryReq = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
})

/** ---------- response schemas ---------- */
export const ApiOkSchema = z.object({ ok: z.literal(true) })
export const ApiErrSchema = z.object({
  ok: z.literal(false),
  message: z.string(),
})

export const CreateCollectionRes = z.object({
  ok: z.literal(true),
  collection: CollectionSchema,
})
export const UpdateCollectionRes = z.object({
  ok: z.literal(true),
  collection: CollectionSchema,
})
export const ListCollectionsRes = z.object({
  ok: z.literal(true),
  collections: z.array(CollectionWithItemsSchema),
})

export const CreateItemRes = z.object({
  ok: z.literal(true),
  itemId: UUID,
  presignedUrls: z.array(z.object({ key: z.string(), url: z.string() })),
})
export const UpdateItemRes = z.object({
  ok: z.literal(true),
  item: WardrobeItemSchema,
})
export const ListItemsRes = z.object({
  ok: z.literal(true),
  items: z.array(WardrobeItemExpandedSchema.or(WardrobeItemSchema)),
})

export const AddPhotoRes = z.object({
  ok: z.literal(true),
  photo: ItemPhotoSchema,
})
export const UpdatePhotoRes = z.object({
  ok: z.literal(true),
  photo: ItemPhotoSchema,
})
export const ListPhotosRes = z.object({
  ok: z.literal(true),
  photos: z.array(ItemPhotoSchema),
})

export const ListStylesRes = z.object({
  ok: z.literal(true),
  styles: z.array(StyleSchema),
})
export const CreateStyleRes = z.object({
  ok: z.literal(true),
  style: StyleSchema,
})
export const UpdateStyleRes = z.object({
  ok: z.literal(true),
  style: StyleSchema,
})

export const ListCategoriesRes = z.object({
  ok: z.literal(true),
  categories: z.array(CategorySchema),
})
export const CreateCategoryRes = z.object({
  ok: z.literal(true),
  category: CategorySchema,
})
export const UpdateCategoryRes = z.object({
  ok: z.literal(true),
  category: CategorySchema,
})
