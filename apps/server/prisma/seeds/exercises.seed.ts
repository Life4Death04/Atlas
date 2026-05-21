import type { PrismaClient } from '../../generated/prisma/client.js'
import { fetchAllExercises } from '../../src/services/ascendapi.client.js';
import { transformExercise } from '../../src/services/ascendapi.transformer.js';

export async function seedExercises(prisma: PrismaClient) {
  console.log('Fetching exercises from AscendAPI (ExerciseDB)...');

  let upserted = 0;
  let skipped = 0;

  for await (const batch of fetchAllExercises(100)) {
    const toUpsert = batch.filter((raw) => raw.name?.trim());
    skipped += batch.length - toUpsert.length;

    await prisma.$transaction(
      toUpsert.map((raw) => {
        const exercise = transformExercise(raw);
        return prisma.exercise.upsert({
          where: { externalId: exercise.externalId },
          update: { ...exercise, lastSyncedAt: new Date() },
          create: exercise,
        });
      }),
    );

    upserted += toUpsert.length;
    process.stdout.write(`\r  Processed ${upserted + skipped} exercises...`);
  }

  console.log(`\nDone: ${upserted} upserted, ${skipped} skipped.`);
}
