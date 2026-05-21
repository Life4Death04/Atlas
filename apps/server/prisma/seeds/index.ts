import { prisma } from '../../src/config/prisma.js';
import { seedExercises } from './exercises.seed.js';

async function main() {
  console.log('Seeding...');
  await seedExercises(prisma);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
