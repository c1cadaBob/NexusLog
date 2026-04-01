const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "../../../../");
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || "5432";
const DB_NAME = process.env.DB_NAME || "nexuslog";
const DB_USER = process.env.DB_USER || "nexuslog";
const DB_PASSWORD = process.env.DB_PASSWORD || "nexuslog_dev";
const PG_CONTAINER = process.env.PG_CONTAINER || "nexuslog-postgres-1";

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function canQueryLocalPsql() {
  try {
    execFileSync("psql", ["-X", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-Atqc", "SELECT 1"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: {
        ...process.env,
        PGPASSWORD: DB_PASSWORD,
        PGCONNECT_TIMEOUT: "2",
      },
    });
    return true;
  } catch {
    return false;
  }
}

function canQueryDockerPsql() {
  try {
    const isRunning = execFileSync("docker", ["inspect", "-f", "{{.State.Running}}", PG_CONTAINER], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .toLowerCase();
    if (isRunning !== "true") {
      return false;
    }

    execFileSync("docker", ["exec", "-i", PG_CONTAINER, "psql", "-X", "-U", DB_USER, "-d", DB_NAME, "-Atqc", "SELECT 1"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function runSql(sql) {
  if (canQueryLocalPsql()) {
    return execFileSync("psql", ["-X", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-AtF", "|", "-qc", sql], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      env: {
        ...process.env,
        PGPASSWORD: DB_PASSWORD,
        PGCONNECT_TIMEOUT: "2",
      },
    }).trim();
  }

  if (canQueryDockerPsql()) {
    return execFileSync("docker", ["exec", "-i", PG_CONTAINER, "psql", "-X", "-U", DB_USER, "-d", DB_NAME, "-AtF", "|", "-qc", sql], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).trim();
  }

  throw new Error("unable to query postgres for runtime db access");
}

module.exports = {
  runSql,
  sqlLiteral,
};
