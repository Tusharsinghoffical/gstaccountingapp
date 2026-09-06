import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma.ts";

async function runBackup() {
  const rootDir = process.cwd();
  const backupsDir = path.join(rootDir, "backups");
  await fs.promises.mkdir(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = path.join(backupsDir, `backup-${timestamp}`);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const targetDbPath = path.join(targetDir, "app.db").replace(/\\/g, "/");

  console.log(`[BACKUP] Starting SQLite online hot backup to: ${targetDbPath}...`);

  // Execute SQLite VACUUM INTO for online, crash-safe point-in-time backup
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${targetDbPath}';`);
    console.log(`[BACKUP] Database backup completed successfully.`);
  } catch (err) {
    console.error(`[BACKUP ERROR] SQLite VACUUM INTO failed:`, err);
    process.exit(1);
  }

  // Backup invoice documents storage
  const storageDir = path.join(rootDir, "storage");
  const targetStorageDir = path.join(targetDir, "storage");

  if (fs.existsSync(storageDir)) {
    console.log(`[BACKUP] Copying local storage folder to ${targetStorageDir}...`);
    await fs.promises.cp(storageDir, targetStorageDir, { recursive: true });
    console.log(`[BACKUP] Storage files backed up successfully.`);
  } else {
    console.log(`[BACKUP] No storage directory found, skipping file copy.`);
  }

  // Write metadata manifest
  const dbStats = await fs.promises.stat(targetDbPath);
  const manifest = {
    backupName: `backup-${timestamp}`,
    createdAt: new Date().toISOString(),
    databaseSizeBytes: dbStats.size,
    targetDbPath,
    targetStorageDir,
  };

  await fs.promises.writeFile(
    path.join(targetDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );

  console.log("============================================================================");
  console.log(`[BACKUP COMPLETE] Backup saved to: ${targetDir}`);
  console.log(`- Database snapshot : ${targetDbPath} (${(dbStats.size / 1024).toFixed(1)} KB)`);
  console.log(`- Storage snapshot  : ${targetStorageDir}`);
  console.log("============================================================================");

  await prisma.$disconnect();
}

runBackup().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
