import { PrismaClient } from '@prisma/client';

// A single shared Prisma instance for the whole process. Avoids exhausting
// database connections when files get hot-reloaded in dev.
export const prisma = new PrismaClient();
