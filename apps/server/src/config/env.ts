import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  AUTH0_DOMAIN: z.string(),
  AUTH0_AUDIENCE: z.string(),
  ASCEND_API_BASE_URL: z.string().url().default('https://oss.exercisedb.dev/api/v1'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
