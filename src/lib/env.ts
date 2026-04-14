import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_APP_NAME: z.string().default('BCS Business Suite'),
  VITE_DEFAULT_LOCALE: z.enum(['en', 'zh-CN', 'zh-HK', 'id-ID']).default('en'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors)
  throw new Error('Environment variables validation failed')
}

export const env = parsed.data
