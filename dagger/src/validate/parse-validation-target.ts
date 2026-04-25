import { parse as parseYaml } from "yaml";

import type {
  ValidationCommandStepDefinition,
  ValidationServiceDefinition,
  ValidationServiceStepSpec,
  ValidationStepDefinition,
  ValidationTargetDefinition,
} from "../model/validation-target.ts";

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_-]*$/;

function parseRequiredString(rawValue: unknown, name: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return rawValue;
}

function parseIdentifier(rawValue: unknown, name: string): string {
  const value = parseRequiredString(rawValue, name);

  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${name} "${value}" must match ${IDENTIFIER_PATTERN}.`);
  }

  return value;
}

function parseMapping(
  rawValue: unknown,
  name: string,
): Record<string, unknown> {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error(`${name} must be a mapping.`);
  }

  return rawValue as Record<string, unknown>;
}

function parseOptionalMapping(
  rawValue: unknown,
  name: string,
): Record<string, unknown> {
  if (rawValue === undefined) {
    return {};
  }

  return parseMapping(rawValue, name);
}

function parseStringArray(rawValue: unknown, name: string): string[] {
  if (rawValue === undefined) {
    return [];
  }

  if (!Array.isArray(rawValue)) {
    throw new Error(`${name} must be an array.`);
  }

  return rawValue.map((entry) => parseRequiredString(entry, `${name} entry`));
}

function parseStringRecord(
  rawValue: unknown,
  name: string,
): Record<string, string> {
  const rawMapping = parseOptionalMapping(rawValue, name);
  const normalizedRecord: Record<string, string> = {};

  for (const [key, entry] of Object.entries(rawMapping)) {
    normalizedRecord[key] = parseRequiredString(entry, `${name}.${key}`);
  }

  return normalizedRecord;
}

function parsePorts(rawValue: unknown, name: string): number[] {
  if (rawValue === undefined) {
    return [];
  }

  if (!Array.isArray(rawValue)) {
    throw new Error(`${name} must be an array.`);
  }

  const normalizedPorts: number[] = [];

  for (const entry of rawValue) {
    if (!Number.isInteger(entry) || entry < 1 || entry > 65_535) {
      throw new Error(`${name} entries must be port numbers from 1 to 65535.`);
    }

    if (!normalizedPorts.includes(entry)) {
      normalizedPorts.push(entry);
    }
  }

  return normalizedPorts;
}

function parseValidationServices(
  rawValue: unknown,
): Record<string, ValidationServiceDefinition> {
  const rawServices = parseOptionalMapping(
    rawValue,
    "Validation target services",
  );
  const services: Record<string, ValidationServiceDefinition> = {};

  for (const [serviceName, rawService] of Object.entries(rawServices)) {
    if (!IDENTIFIER_PATTERN.test(serviceName)) {
      throw new Error(
        `Validation target service name "${serviceName}" must match ${IDENTIFIER_PATTERN}.`,
      );
    }

    const service = parseMapping(
      rawService,
      `Validation target service "${serviceName}"`,
    );

    services[serviceName] = {
      env: parseStringRecord(
        "env" in service ? service.env : undefined,
        `Validation target service "${serviceName}" env`,
      ),
      image: parseRequiredString(
        "image" in service ? service.image : undefined,
        `Validation target service "${serviceName}" image`,
      ),
      ports: parsePorts(
        "ports" in service ? service.ports : undefined,
        `Validation target service "${serviceName}" ports`,
      ),
    };
  }

  return services;
}

function parseServiceStepSpec(
  rawValue: unknown,
  stepName: string,
): ValidationServiceStepSpec {
  const service = parseMapping(
    rawValue,
    `Validation target step "${stepName}" service`,
  );

  return {
    args: parseStringArray(
      "args" in service ? service.args : undefined,
      `Validation target step "${stepName}" service args`,
    ),
    command: parseRequiredString(
      "command" in service ? service.command : undefined,
      `Validation target step "${stepName}" service command`,
    ),
    env: parseStringRecord(
      "env" in service ? service.env : undefined,
      `Validation target step "${stepName}" service env`,
    ),
    ports: parsePorts(
      "ports" in service ? service.ports : undefined,
      `Validation target step "${stepName}" service ports`,
    ),
  };
}

function parseValidationCommandStep(
  rawStep: Record<string, unknown>,
  stepName: string,
): ValidationCommandStepDefinition {
  return {
    args: parseStringArray(
      "args" in rawStep ? rawStep.args : undefined,
      `Validation target step "${stepName}" args`,
    ),
    command: parseRequiredString(
      "command" in rawStep ? rawStep.command : undefined,
      `Validation target step "${stepName}" command`,
    ),
    env: parseStringRecord(
      "env" in rawStep ? rawStep.env : undefined,
      `Validation target step "${stepName}" env`,
    ),
    kind: "command",
    name: stepName,
  };
}

function parseValidationStep(rawValue: unknown): ValidationStepDefinition {
  const rawStep = parseMapping(rawValue, "Validation target step");
  const stepName = parseIdentifier(
    "name" in rawStep ? rawStep.name : undefined,
    "Validation target step name",
  );
  const hasCommand = "command" in rawStep;
  const hasService = "service" in rawStep;

  if (hasCommand && hasService) {
    throw new Error(
      `Validation target step "${stepName}" must define either command or service, not both.`,
    );
  }

  if (hasService) {
    return {
      kind: "service",
      name: stepName,
      service: parseServiceStepSpec(rawStep.service, stepName),
    };
  }

  if (hasCommand) {
    return parseValidationCommandStep(rawStep, stepName);
  }

  throw new Error(
    `Validation target step "${stepName}" must define command or service.`,
  );
}

function parseValidationSteps(rawValue: unknown): ValidationStepDefinition[] {
  if (rawValue === undefined) {
    return [];
  }

  if (!Array.isArray(rawValue)) {
    throw new Error("Validation target steps must be an array.");
  }

  const seenStepNames = new Set<string>();
  const steps = rawValue.map(parseValidationStep);

  for (const step of steps) {
    if (seenStepNames.has(step.name)) {
      throw new Error(`Duplicate validation target step "${step.name}".`);
    }

    seenStepNames.add(step.name);
  }

  return steps;
}

export function parseValidationTarget(
  validationTargetYaml: string,
): ValidationTargetDefinition {
  const parsedValue = parseYaml(validationTargetYaml);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error("Validation target file must define a top-level mapping.");
  }

  return {
    name: parseIdentifier(
      "name" in parsedValue ? parsedValue.name : undefined,
      "Validation target name",
    ),
    services: parseValidationServices(
      "services" in parsedValue ? parsedValue.services : undefined,
    ),
    steps: parseValidationSteps(
      "steps" in parsedValue ? parsedValue.steps : undefined,
    ),
  };
}
