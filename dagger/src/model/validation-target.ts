export type ValidationServiceDefinition = {
  env: Record<string, string>;
  image: string;
  ports: number[];
};

export type ValidationCommandStepDefinition = {
  args: string[];
  command: string;
  env: Record<string, string>;
  kind: "command";
  name: string;
};

export type ValidationServiceStepSpec = {
  args: string[];
  command: string;
  env: Record<string, string>;
  ports: number[];
};

export type ValidationServiceStepDefinition = {
  kind: "service";
  name: string;
  service: ValidationServiceStepSpec;
};

export type ValidationStepDefinition =
  | ValidationCommandStepDefinition
  | ValidationServiceStepDefinition;

export type ValidationTargetDefinition = {
  name: string;
  services: Record<string, ValidationServiceDefinition>;
  steps: ValidationStepDefinition[];
};
