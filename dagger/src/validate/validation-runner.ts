import { Container, dag, Directory, Service } from "@dagger.io/dagger";

import type {
  ValidationCommandStepDefinition,
  ValidationServiceDefinition,
  ValidationServiceStepDefinition,
  ValidationServiceStepSpec,
  ValidationTargetDefinition,
} from "../model/validation-target.ts";
import { validationTargetDefinitionPath } from "./metadata-paths.ts";
import { loadValidationTargetDefinition } from "./load-validation-metadata.ts";

export type ValidationMetadataRunResult = {
  container: Container;
  metadataTargets: string[];
};

type ForegroundService = {
  name: string;
  spec: ValidationServiceStepSpec;
};

const SHELL_ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function commandArgs(command: string, args: string[]): string[] {
  return [command, ...args];
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function shellCommand(command: string, args: string[]): string {
  return commandArgs(command, args).map(shellQuote).join(" ");
}

function envExportLines(env: Record<string, string>): string[] {
  return Object.entries(env).map(([name, value]) => {
    if (!SHELL_ENV_NAME_PATTERN.test(name)) {
      throw new Error(
        `Validation metadata env name "${name}" is not a shell-compatible variable name.`,
      );
    }

    return `export ${name}=${shellQuote(value)}`;
  });
}

function withEnv(container: Container, env: Record<string, string>): Container {
  let nextContainer = container;

  for (const [name, value] of Object.entries(env)) {
    nextContainer = nextContainer.withEnvVariable(name, value);
  }

  return nextContainer;
}

function withExposedPorts(container: Container, ports: number[]): Container {
  let nextContainer = container;

  for (const port of ports) {
    nextContainer = nextContainer.withExposedPort(port);
  }

  return nextContainer;
}

function withServiceBindings(
  container: Container,
  services: Record<string, Service>,
): Container {
  let nextContainer = container;

  for (const [alias, service] of Object.entries(services)) {
    nextContainer = nextContainer.withServiceBinding(alias, service);
  }

  return nextContainer;
}

function createBackingService(service: ValidationServiceDefinition): Service {
  return withExposedPorts(
    withEnv(dag.container().from(service.image), service.env),
    service.ports,
  ).asService();
}

function createBackingServices(
  target: ValidationTargetDefinition,
): Record<string, Service> {
  return Object.fromEntries(
    Object.entries(target.services).map(([name, service]) => [
      name,
      createBackingService(service),
    ]),
  );
}

function foregroundServiceLines(service: ForegroundService): string[] {
  return [
    "(",
    ...envExportLines(service.spec.env).map((line) => `  ${line}`),
    `  exec ${shellCommand(service.spec.command, service.spec.args)}`,
    ") &",
    'pids+=("$!")',
  ];
}

function commandStepScript(
  step: ValidationCommandStepDefinition,
  foregroundServices: ForegroundService[],
): string {
  return [
    "set -euo pipefail",
    "pids=()",
    "cleanup() {",
    "  local status=$?",
    '  for pid in "${pids[@]}"; do',
    '    kill "${pid}" 2>/dev/null || true',
    "  done",
    "  wait 2>/dev/null || true",
    '  return "${status}"',
    "}",
    "trap cleanup EXIT",
    ...foregroundServices.flatMap(foregroundServiceLines),
    ...envExportLines(step.env),
    shellCommand(step.command, step.args),
  ].join("\n");
}

function runCommandStep(
  container: Container,
  step: ValidationCommandStepDefinition,
  services: Record<string, Service>,
  foregroundServices: ForegroundService[],
): Container {
  if (foregroundServices.length > 0) {
    return withServiceBindings(container, services).withExec(
      ["bash", "-lc", commandStepScript(step, foregroundServices)],
      { expand: false },
    );
  }

  return withEnv(withServiceBindings(container, services), step.env).withExec(
    commandArgs(step.command, step.args),
    { expand: false },
  );
}

function registerServiceStep(
  step: ValidationServiceStepDefinition,
  foregroundServices: ForegroundService[],
): ForegroundService[] {
  return [...foregroundServices, { name: step.name, spec: step.service }];
}

async function loadValidationMetadataTargets(
  repo: Directory,
  validateTargets: string[],
): Promise<ValidationTargetDefinition[]> {
  const definitions: ValidationTargetDefinition[] = [];

  for (const target of validateTargets) {
    const metadataPath = validationTargetDefinitionPath(target);

    if (!(await repo.exists(metadataPath))) {
      console.log(`[validate] ${target}: no validation metadata`);
      continue;
    }

    definitions.push(await loadValidationTargetDefinition(repo, target));
  }

  return definitions;
}

async function runValidationTarget(
  container: Container,
  target: ValidationTargetDefinition,
): Promise<Container> {
  console.log(`[validate] ${target.name}: metadata steps`);

  let services = createBackingServices(target);
  let foregroundServices: ForegroundService[] = [];
  let nextContainer = container;

  for (const step of target.steps) {
    console.log(`[validate] ${target.name}: ${step.name}`);

    if (step.kind === "command") {
      nextContainer = runCommandStep(
        nextContainer,
        step,
        services,
        foregroundServices,
      );
      continue;
    }

    foregroundServices = registerServiceStep(step, foregroundServices);
  }

  await nextContainer.sync();

  return container;
}

export async function runValidationMetadataStage(
  repo: Directory,
  container: Container,
  validateTargets: string[],
): Promise<ValidationMetadataRunResult> {
  const validationTargets = await loadValidationMetadataTargets(
    repo,
    validateTargets,
  );
  let nextContainer = container;

  for (const validationTarget of validationTargets) {
    nextContainer = await runValidationTarget(nextContainer, validationTarget);
  }

  return {
    container: nextContainer,
    metadataTargets: validationTargets.map((target) => target.name),
  };
}
