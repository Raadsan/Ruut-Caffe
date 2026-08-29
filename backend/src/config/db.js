import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;

  const isDev = process.env.NODE_ENV !== 'production';
  const defaultLimit = process.env.DATABASE_POOL_LIMIT || (isDev ? '1' : '10');

  const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
  if (!params.has('connection_limit')) params.set('connection_limit', defaultLimit);
  if (!params.has('pool_timeout')) params.set('pool_timeout', '20');
  if (!params.has('connect_timeout')) params.set('connect_timeout', '5');

  const base = url.split('?')[0];
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    datasources: {
      db: { url: getDatabaseUrl() },
    },
  });
}

const prisma = globalForPrisma.prisma;

process.on('beforeExit', async () => {
  await prisma.$disconnect().catch(() => {});
});

export default prisma;
