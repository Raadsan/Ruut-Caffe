import prisma from '../../src/config/db.js';

async function main() {
  const cols = await prisma.$queryRaw`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user'
      AND COLUMN_NAME IN ('username', 'posPin')
  `;
  const existing = new Set(cols.map((c) => c.COLUMN_NAME));

  if (!existing.has('username')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `user` ADD COLUMN `username` VARCHAR(191) NULL'
    );
    console.log('Added column: username');
  } else {
    console.log('Column already exists: username');
  }

  if (!existing.has('posPin')) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `user` ADD COLUMN `posPin` VARCHAR(191) NULL'
    );
    console.log('Added column: posPin');
  } else {
    console.log('Column already exists: posPin');
  }

  const indexes = await prisma.$queryRaw`
    SELECT INDEX_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user'
      AND INDEX_NAME = 'user_username_key'
  `;

  if (indexes.length === 0) {
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX `user_username_key` ON `user`(`username`)'
    );
    console.log('Added unique index: user_username_key');
  } else {
    console.log('Index already exists: user_username_key');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
