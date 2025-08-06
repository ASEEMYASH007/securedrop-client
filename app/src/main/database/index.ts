import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import Database from "better-sqlite3";

let db: Database.Database | null = null;
let databaseUrl: string | null = null;

export const openDatabase = (): Database.Database => {
  if (db) {
    return db;
  }

  // Ensure the directory exists
  const dbDir = path.join(os.homedir(), ".config", "SecureDrop");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Create or open the SQLite database
  const dbPath = path.join(dbDir, "db.sqlite");
  db = new Database(dbPath, {});
  db.pragma("journal_mode = WAL");

  // Set the database URL for migrations
  databaseUrl = `sqlite:${dbPath}`;
  return db;
};

export const runMigrations = () => {
  if (!databaseUrl) {
    throw new Error(
      "Database URL is not set. Ensure the database is opened first.",
    );
  }

  // Determine if we're in a packaged app or development
  const isPackaged = __dirname.includes("app.asar");

  let dbmatePath: string;
  let migrationsDir: string;

  if (isPackaged) {
    // For packaged apps, binaries and migrations are outside the asar archive
    dbmatePath = path.join(process.resourcesPath, "bin", "dbmate");
    migrationsDir = path.join(process.resourcesPath, "migrations");
  } else {
    // In development, use paths relative to current working directory
    dbmatePath = path.join(process.cwd(), "node_modules", ".bin", "dbmate");
    migrationsDir = path.join(
      process.cwd(),
      "src",
      "main",
      "database",
      "migrations",
    );
  }

  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  // Ensure dbmate binary exists
  if (!fs.existsSync(dbmatePath)) {
    throw new Error(`dbmate binary not found: ${dbmatePath}`);
  }

  return new Promise<void>((resolve, reject) => {
    // Use spawn with argument array to prevent command injection
    const args: string[] = [
      "--url",
      databaseUrl as string, // We already checked it's not null at the beginning
      "--migrations-dir",
      migrationsDir,
      // Don't update the schema file when running migrations at app startup
      "--schema-file",
      "/dev/null",
      "up",
    ];

    console.log("Running migrations:", dbmatePath, args.join(" "));

    const child = spawn(dbmatePath, args, {
      stdio: "inherit",
      // Explicitly disable shell to prevent any command interpretation
      shell: false,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log("Migrations completed successfully");
        resolve();
      } else {
        const error = new Error(`Migration failed with exit code: ${code}`);
        console.error("Migration failed:", error);
        reject(error);
      }
    });

    child.on("error", (error) => {
      console.error("Migration failed:", error);
      reject(new Error(`Migration failed: ${error}`));
    });
  });
};

export const closeDatabase = () => {
  if (db) {
    db.close();
    db = null;
  }
};
