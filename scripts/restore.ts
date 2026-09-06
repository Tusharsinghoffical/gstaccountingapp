import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma.ts";

async function runRestore() {
  const rootDir = process.cwd();
  const backupsDir = path.join(rootDir, "backups");

  if (!fs.existsSync(backupsDir)) {
    console.error(`[RESTORE ERROR] Backups directory not found at: ${backupsDir}`);
    process.exit(1);
  }

  // Determine which backup to restore
  const specifiedBackup = process.argv[2];
  let backupToRestore = "";

  if (specifiedBackup) {
    backupToRestore = path.isAbsolute(specifiedBackup)
      ? specifiedBackup
      : path.join(backupsDir, specifiedBackup);
  } else {
    // Find latest backup directory
    const entries = await fs.promises.readdir(backupsDir, { withFileTypes: true });
    const backupDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
      .map((e) => e.name)
      .sort()
      .reverse();

    if (backupDirs.length === 0) {
      console.error("[RESTORE ERROR] No valid backup directories found in ./backups");
      process.exit(1);
    }

    backupToRestore = path.join(backupsDir, backupDirs[0]);
  }

  const sourceDbPath = path.join(backupToRestore, "app.db");
  if (!fs.existsSync(sourceDbPath)) {
    console.error(`[RESTORE ERROR] app.db not found in backup: ${sourceDbPath}`);
    process.exit(1);
  }

  console.log(`[RESTORE] Restoring from: ${backupToRestore}...`);

  // Disconnect active prisma client before replacing database file
  await prisma.$disconnect();

  const dataDir = path.join(rootDir, "data");
  await fs.promises.mkdir(dataDir, { recursive: true });
  const activeDbPath = path.join(dataDir, "app.db");

  // Remove existing WAL/SHM files to prevent state corruption
  const walPath = path.join(dataDir, "app.db-wal");
  const shmPath = path.join(dataDir, "app.db-shm");
  if (fs.existsSync(walPath)) await fs.promises.unlink(walPath);
  if (fs.existsSync(shmPath)) await fs.promises.unlink(shmPath);

  // Copy snapshot database into active data directory
  await fs.promises.copyFile(sourceDbPath, activeDbPath);
  console.log(`[RESTORE] Database restored to: ${activeDbPath}`);

  // Restore storage folder if present
  const sourceStorage = path.join(backupToRestore, "storage");
  const activeStorage = path.join(rootDir, "storage");

  if (fs.existsSync(sourceStorage)) {
    await fs.promises.mkdir(activeStorage, { recursive: true });
    await fs.promises.cp(sourceStorage, activeStorage, { recursive: true });
    console.log(`[RESTORE] Storage documents restored to: ${activeStorage}`);
  }

  // Re-connect and run integrity check
  await prisma.$connect();
  const integrityResult = await prisma.$queryRawUnsafe<Array<{ integrity_check: string }>>(
    "PRAGMA integrity_check;"
  );

  const status = integrityResult?.[0]?.integrity_check || "unknown";
  console.log(`[RESTORE] SQLite Integrity Check: ${status}`);

  if (status !== "ok") {
    console.error("[RESTORE WARNING] Integrity check returned issues:", integrityResult);
  }

  console.log("============================================================================");
  console.log(`[RESTORE COMPLETE] Successfully restored system from ${backupToRestore}`);
  console.log("============================================================================");

  await prisma.$disconnect();
}

runRestore().catch((e) => {
  console.error("[RESTORE FATAL]", e);
  process.exit(1);
});
