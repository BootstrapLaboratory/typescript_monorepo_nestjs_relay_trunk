import { spawn } from "node:child_process";

export class ShellCommandError extends Error {
  constructor({ args, command, exitCode, signal, stderr, stdout }) {
    const status = signal === null ? `exit ${exitCode}` : `signal ${signal}`;

    super(`Command failed with ${status}: ${formatCommand(command, args)}`);
    this.name = "ShellCommandError";
    this.args = args;
    this.command = command;
    this.exitCode = exitCode;
    this.signal = signal;
    this.stderr = stderr;
    this.stdout = stdout;
  }
}

export async function runShell(command, options = {}) {
  const args = options.args ?? [];
  const envInput = options.env ?? {};
  const redactor = createRedactor({
    env: envInput,
    redact: options.redact ?? [],
  });
  const child = spawn(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      ...stringifyEnv(envInput),
    },
    shell: options.shell === true,
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk) => {
    const redacted = redactor.redact(chunk.toString());
    stdout += redacted;
    options.stdout?.write(redacted);
  });

  child.stderr?.on("data", (chunk) => {
    const redacted = redactor.redact(chunk.toString());
    stderr += redacted;
    options.stderr?.write(redacted);
  });

  const { exitCode, signal } = await waitForChild(child);

  if (exitCode !== 0) {
    throw new ShellCommandError({
      args: redactor.redactArgs(args),
      command,
      exitCode,
      signal,
      stderr,
      stdout,
    });
  }

  return {
    args: redactor.redactArgs(args),
    command,
    exitCode,
    signal,
    stderr,
    stdout,
  };
}

function createRedactor({ env, redact }) {
  const replacements = redact
    .map((entry) => {
      if (Object.hasOwn(env, entry)) {
        return {
          label: entry,
          value: stringifyEnvValue(env[entry]),
        };
      }

      return {
        label: "secret",
        value: String(entry),
      };
    })
    .filter((entry) => entry.value !== "");

  const redactText = (text) =>
    replacements.reduce(
      (current, entry) =>
        current.split(entry.value).join(`[redacted:${entry.label}]`),
      text,
    );

  return {
    redact: redactText,
    redactArgs(args) {
      return args.map((argument) => redactText(argument));
    },
  };
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function stringifyEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([name, value]) => [name, stringifyEnvValue(value)]),
  );
}

function stringifyEnvValue(value) {
  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

async function waitForChild(child) {
  return await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      resolve({ exitCode, signal });
    });
  });
}
