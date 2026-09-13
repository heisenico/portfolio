import { z } from 'astro/zod';
import { PLACE_IDS } from '../map/places';

const photo = z.object({ type: z.literal('photo'), src: z.string().optional(), alt: z.string().min(1) });
const gallery = z.object({
  type: z.literal('gallery'),
  items: z.array(z.object({ src: z.string().optional(), alt: z.string().min(1), video: z.boolean().optional() })).min(1),
});
const video = z.object({ type: z.literal('video'), url: z.string().url(), alt: z.string().min(1) });

export const entrySchema = z.object({
  title: z.string().min(1),
  date: z.coerce.date(),
  place: z.enum(PLACE_IDS),
  media: z.discriminatedUnion('type', [photo, gallery, video]).optional(),
});
export type EntryData = z.infer<typeof entrySchema>;
