const BASE_URL = process.env['ASCEND_API_BASE_URL'] ?? 'https://oss.exercisedb.dev/api/v1';

export interface AscendExercise {
  exerciseId: string;
  name: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
}

interface AscendMeta {
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

interface AscendResponse<T> {
  success: boolean;
  meta: AscendMeta;
  data: T[];
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<AscendResponse<T>> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`AscendAPI ${res.status}: ${url.pathname}`);

  const json = await res.json() as AscendResponse<T>;
  if (!json.success) throw new Error(`AscendAPI returned success=false for ${url.pathname}`);

  return json;
}

export async function fetchByTargetMuscle(
  targetMuscle: string,
  limit = 1,
  after = '',
): Promise<AscendResponse<AscendExercise>> {
  return get<AscendExercise>('/exercises/muscles', {
    targetMuscles: targetMuscle,
    limit: String(limit),
    after,
  });
}

export async function* fetchAllExercises(batchSize = 100): AsyncGenerator<AscendExercise[]> {
  let after: string | undefined;

  do {
    const data = await get<AscendExercise>('/exercises', {
      limit: String(batchSize),
      ...(after ? { after } : {}),
    });

    yield data.data;
    after = data.meta.hasNextPage ? data.meta.nextCursor : undefined;
  } while (after);
}
