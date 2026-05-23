/**
 * Test script: fetch 1 exercise per muscle group (10 total), transform, print
 * a before/after comparison, then upsert into the DB.
 *
 * Run: pnpm db:test-exercises
 */
import { prisma } from '../../src/config/prisma.js';
import type { AscendExercise } from '../../src/services/ascendapi.client.js';
import { fetchByTargetMuscle } from '../../src/services/ascendapi.client.js';
import { transformExercise } from '../../src/services/ascendapi.transformer.js';

const TARGET_MUSCLES = [
  'pectorals',    // chest
  'lats',         // back
  'delts',        // shoulders
  'biceps',       // biceps
  'triceps',      // triceps
  'abs',          // core
  'quadriceps',   // quads
  'hamstrings',   // hamstrings
  'glutes',       // glutes
  'calves',       // calves
];

function printSeparator(label: string) {
  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${label}`);
  console.log(line);
}

function printComparison(raw: AscendExercise, index: number) {
  const transformed = transformExercise(raw);

  printSeparator(`Exercise ${index + 1} — "${raw.name}"`);

  console.log('\n[RAW from AscendAPI]');
  console.log(JSON.stringify({
    exerciseId: raw.exerciseId,
    bodyParts: raw.bodyParts,
    equipments: raw.equipments,
    targetMuscles: raw.targetMuscles,
    secondaryMuscles: raw.secondaryMuscles,
  }, null, 2));

  console.log('\n[TRANSFORMED]');
  console.log(JSON.stringify({
    externalId: transformed.externalId,
    muscleGroup: transformed.muscleGroup,
    secondaryMuscles: transformed.secondaryMuscles,
    equipment: transformed.equipment,
    category: transformed.category,
    difficulty: transformed.difficulty,
  }, null, 2));
}

async function main() {
  try {
    console.log('Fetching 1 exercise per muscle group from AscendAPI...\n');

    const rawExercises: AscendExercise[] = [];

    for (const muscle of TARGET_MUSCLES) {
      process.stdout.write(`  Fetching "${muscle}"... `);
      const res = await fetchByTargetMuscle(muscle, 1);
      const exercise = res.data[0];

      if (!exercise) {
        console.log('no results, skipping');
        continue;
      }

      rawExercises.push(exercise);
      console.log(`got "${exercise.name}"`);
    }

    // Print before/after for each
    for (const [i, exercise] of rawExercises.entries()) {
      printComparison(exercise, i);
    }

    // Upsert into DB
    printSeparator('Upserting into database...');
    let saved = 0;

    for (const raw of rawExercises) {
      const exercise = transformExercise(raw);
      await prisma.exercise.upsert({
        where: { externalId: exercise.externalId },
        update: { ...exercise, lastSyncedAt: new Date() },
        create: exercise,
      });
      saved++;
      console.log(`  ✓ "${exercise.name}" → ${exercise.muscleGroup} / ${exercise.equipment} / ${exercise.category}`);
    }

    console.log(`\n✓ ${saved} exercises stored. Check with: pnpm db:studio\n`);

  } finally {
    await prisma.$disconnect();
  }
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
});
