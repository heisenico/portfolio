import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { entrySchema } from './content/schema';

const diario = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/diario' }),
  schema: entrySchema,
});

export const collections = { diario };
