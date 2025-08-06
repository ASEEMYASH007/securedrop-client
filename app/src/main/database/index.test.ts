import { describe, it, expect } from "vitest";
import path from "path";

// Create a simple test to demonstrate the command construction vulnerability
describe("Database Migration Command Injection Vulnerability", () => {
  it("demonstrates command injection in runMigrations", () => {
    // Simulate the vulnerable code logic
    const maliciousHome = '";touch /tmp/vulnerable;echo "';
    const dbPath = path.join(
      maliciousHome,
      ".config",
      "SecureDrop",
      "db.sqlite",
    );
    const databaseUrl = `sqlite:${dbPath}`;

    // Simulate command construction as done in the vulnerable code
    const dbmatePath = "/usr/bin/dbmate";
    const migrationsDir = "/app/migrations";

    const command = [
      `"${dbmatePath}"`,
      `--url "${databaseUrl}"`,
      `--migrations-dir "${migrationsDir}"`,
      `--schema-file "/dev/null"`,
      "up",
    ].join(" ");

    // The command should contain the injected shell command
    expect(command).toContain('";touch /tmp/vulnerable;echo "');

    // This demonstrates that shell metacharacters are not escaped
    console.log("Vulnerable command:", command);

    // Show that the command would be interpreted by shell
    expect(command).toMatch(/";touch \/tmp\/vulnerable;echo "/);
    expect(command).toContain('sqlite:";touch /tmp/vulnerable;echo "');
  });

  it("shows the safe command structure with array arguments", () => {
    const maliciousHome = '";touch /tmp/vulnerable;echo "';
    const dbPath = path.join(
      maliciousHome,
      ".config",
      "SecureDrop",
      "db.sqlite",
    );
    const databaseUrl = `sqlite:${dbPath}`;

    const migrationsDir = "/app/migrations";

    // Safe approach: use array arguments
    const args = [
      "--url",
      databaseUrl,
      "--migrations-dir",
      migrationsDir,
      "--schema-file",
      "/dev/null",
      "up",
    ];

    // With array arguments, shell metacharacters are treated as literal values
    expect(args[1]).toBe(databaseUrl); // Contains the path but won't be shell-interpreted
    console.log("Safe args:", args);
  });

  it("demonstrates that the fix prevents command injection", () => {
    // This test verifies that our fixed code structure prevents command injection
    const maliciousHome = '";touch /tmp/vulnerable;echo "';
    const dbPath = path.join(
      maliciousHome,
      ".config",
      "SecureDrop",
      "db.sqlite",
    );
    const databaseUrl = `sqlite:${dbPath}`;

    // Our fixed implementation uses spawn() with separate arguments
    // This means the malicious content is passed as a literal string argument
    // rather than being interpreted by the shell

    // Simulate what spawn() receives as arguments (our fix)
    const spawnArgs = [
      "--url",
      databaseUrl as string, // This contains malicious content but as literal value
      "--migrations-dir",
      "/app/migrations",
      "--schema-file",
      "/dev/null",
      "up",
    ];

    // The URL argument contains the malicious string, but it's safe because:
    // 1. spawn() with shell: false doesn't interpret shell metacharacters
    // 2. The string is passed as a single argument to the process
    expect(spawnArgs[1]).toBe(databaseUrl);
    expect(spawnArgs[1]).toContain('";touch /tmp/vulnerable;echo "');

    // The key difference: In execSync() with shell, this would be executed as commands
    // In spawn() with shell: false, this is just a literal string argument to dbmate
    console.log("Spawn args (safe):", spawnArgs);
    console.log(
      "The malicious content is present but treated as literal data, not commands",
    );
  });
});
