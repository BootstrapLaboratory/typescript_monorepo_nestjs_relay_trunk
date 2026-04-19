import { createRequire } from "node:module";

const requireFromServer = createRequire(
  new URL("../../../apps/server/package.json", import.meta.url),
);
const { Client } = requireFromServer("pg");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
  const pooledUrl = requireEnv("DATABASE_URL");
  const directUrl = requireEnv("DATABASE_URL_DIRECT");
  const roleName = requireEnv("NEON_APP_ROLE");
  const rolePassword = requireEnv("NEON_APP_PASSWORD");

  const pooled = new URL(pooledUrl);
  const direct = new URL(directUrl);

  const databaseName = decodeURIComponent(direct.pathname.replace(/^\/+/, ""));
  if (!databaseName) {
    throw new Error(
      "Could not determine database name from DATABASE_URL_DIRECT",
    );
  }

  const roleIdentifier = quoteIdentifier(roleName);
  const rolePasswordLiteral = quoteLiteral(rolePassword);
  const databaseIdentifier = quoteIdentifier(databaseName);

  const adminClient = new Client({
    connectionString: directUrl,
  });

  await adminClient.connect();

  try {
    const existingRole = await adminClient.query(
      "select 1 from pg_roles where rolname = $1",
      [roleName],
    );

    if (existingRole.rowCount > 0) {
      console.error(
        `Rotating password for existing Neon app role "${roleName}".`,
      );
      await adminClient.query(
        `ALTER ROLE ${roleIdentifier} WITH LOGIN PASSWORD ${rolePasswordLiteral}`,
      );
    } else {
      console.error(`Creating Neon app role "${roleName}".`);
      await adminClient.query(
        `CREATE ROLE ${roleIdentifier} WITH LOGIN PASSWORD ${rolePasswordLiteral}`,
      );
    }

    await adminClient.query(
      `GRANT CONNECT ON DATABASE ${databaseIdentifier} TO ${roleIdentifier}`,
    );
    await adminClient.query(
      `GRANT USAGE ON SCHEMA public TO ${roleIdentifier}`,
    );
    await adminClient.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${roleIdentifier}`,
    );
    await adminClient.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${roleIdentifier}`,
    );
    await adminClient.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${roleIdentifier}`,
    );
    await adminClient.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${roleIdentifier}`,
    );
  } finally {
    await adminClient.end();
  }

  const runtimeUrl = new URL(pooledUrl);
  runtimeUrl.username = roleName;
  runtimeUrl.password = rolePassword;

  const runtimeClient = new Client({
    connectionString: runtimeUrl.toString(),
  });

  await runtimeClient.connect();

  try {
    await runtimeClient.query("BEGIN");
    await runtimeClient.query("SELECT id FROM public.message LIMIT 1");
    await runtimeClient.query(
      "INSERT INTO public.message(author, body) VALUES ($1, $2)",
      ["cloudrun-role-check", "least-privilege verification"],
    );
    await runtimeClient.query("ROLLBACK");
  } finally {
    await runtimeClient.end();
  }

  console.error(
    `Verified runtime access for "${roleName}" against database "${databaseName}".`,
  );
  process.stdout.write(runtimeUrl.toString());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
