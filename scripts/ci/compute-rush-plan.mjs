import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const TARGET_NAMES = ['server', 'webapp'];
const DEPLOY_TAG_PREFIX = process.env.DEPLOY_TAG_PREFIX ?? 'deploy/prod';

function run(command, args) {
  return execFileSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function writeOutput(name, value) {
  const normalizedValue = String(value);

  if (OUTPUT_PATH) {
    appendFileSync(OUTPUT_PATH, `${name}=${normalizedValue}\n`, 'utf8');
  }

  console.log(`${name}=${normalizedValue}`);
}

function parseTargetList(value) {
  const parsedValue = JSON.parse(value);

  if (!Array.isArray(parsedValue)) {
    throw new Error('FORCE_TARGETS_JSON must be a JSON array.');
  }

  const normalizedTargets = [];
  for (const targetName of parsedValue) {
    if (typeof targetName !== 'string' || targetName.length === 0) {
      throw new Error('FORCE_TARGETS_JSON entries must be non-empty strings.');
    }

    if (!TARGET_NAMES.includes(targetName)) {
      throw new Error(`Unsupported forced target "${targetName}".`);
    }

    if (!normalizedTargets.includes(targetName)) {
      normalizedTargets.push(targetName);
    }
  }

  return normalizedTargets;
}

function hasGitCommit(ref) {
  try {
    run('git', ['rev-parse', '--verify', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveBaseSha(tagName) {
  if (!hasGitCommit(tagName)) {
    return '';
  }

  return run('git', ['rev-parse', `${tagName}^{commit}`]);
}

function rushAffectedProjects(baseSha) {
  if (!baseSha) {
    return [];
  }

  const output = run('node', [
    'common/scripts/install-run-rush.js',
    'list',
    '--json',
    '--from',
    `git:${baseSha}`,
  ]);
  const jsonStartIndex = output.indexOf('{');

  if (jsonStartIndex === -1) {
    throw new Error(`Rush did not emit JSON for base SHA ${baseSha}.`);
  }

  const parsedOutput = JSON.parse(output.slice(jsonStartIndex));

  return [...new Set(parsedOutput.projects.map((project) => project.name))].sort();
}

function projectSetContains(projects, projectName) {
  return projects.includes(projectName);
}

function buildAffectedProjectsByTarget(resolver) {
  return Object.fromEntries(
    TARGET_NAMES.map((targetName) => [targetName, [...resolver(targetName)]]),
  );
}

function buildDeployTagName(targetName) {
  return `${DEPLOY_TAG_PREFIX}/${targetName}`;
}

const eventName = process.env.GITHUB_EVENT_NAME ?? '';
const forceTargets = parseTargetList(process.env.FORCE_TARGETS_JSON ?? '[]');

if (!eventName) {
  throw new Error('GITHUB_EVENT_NAME is required.');
}

if (eventName === 'pull_request') {
  const prBaseSha = process.env.PR_BASE_SHA ?? '';

  if (!prBaseSha) {
    throw new Error('PR_BASE_SHA is required for pull_request events.');
  }

  if (!hasGitCommit(prBaseSha)) {
    throw new Error(`The pull request base SHA "${prBaseSha}" is not available locally.`);
  }

  const normalizedBaseSha = run('git', ['rev-parse', `${prBaseSha}^{commit}`]);
  const affectedProjects = rushAffectedProjects(normalizedBaseSha);
  const validateTargets = [];

  if (projectSetContains(affectedProjects, 'server')) {
    validateTargets.push('server');
  }
  if (projectSetContains(affectedProjects, 'webapp')) {
    validateTargets.push('webapp');
  }

  const affectedProjectsByTarget = buildAffectedProjectsByTarget((targetName) =>
    projectSetContains(affectedProjects, targetName) ? affectedProjects : [],
  );

  writeOutput('mode', 'pull_request');
  writeOutput('pr_base_sha', normalizedBaseSha);
  writeOutput(
    'affected_projects_by_target_json',
    JSON.stringify(affectedProjectsByTarget),
  );
  writeOutput('validate_targets_json', JSON.stringify(validateTargets));
  writeOutput('deploy_targets_json', '[]');
  writeOutput('any_scope', String(validateTargets.length > 0));
  process.exit(0);
}

const currentHeadSha = run('git', ['rev-parse', 'HEAD^{commit}']);
const targetServerOnly =
  eventName === 'workflow_call' &&
  forceTargets.length === 1 &&
  forceTargets.includes('server');
const targetWebappOnly =
  eventName === 'workflow_call' &&
  forceTargets.length === 1 &&
  forceTargets.includes('webapp');

const serverBaseSha = targetWebappOnly
  ? currentHeadSha
  : resolveBaseSha(buildDeployTagName('server'));
const webappBaseSha = targetServerOnly
  ? currentHeadSha
  : resolveBaseSha(buildDeployTagName('webapp'));

const serverAffectedProjects = serverBaseSha ? rushAffectedProjects(serverBaseSha) : [];
const webappAffectedProjects = webappBaseSha ? rushAffectedProjects(webappBaseSha) : [];

const deployServer =
  forceTargets.includes('server') ||
  !serverBaseSha ||
  projectSetContains(serverAffectedProjects, 'server');
const deployWebapp =
  forceTargets.includes('webapp') ||
  !webappBaseSha ||
  projectSetContains(webappAffectedProjects, 'webapp');

const deployTargets = [];
if (deployServer) {
  deployTargets.push('server');
}
if (deployWebapp) {
  deployTargets.push('webapp');
}

const releaseAffectedProjectsByTarget = {
  server: serverAffectedProjects,
  webapp: webappAffectedProjects,
};
const affectedProjectsByTarget = buildAffectedProjectsByTarget(
  (targetName) => releaseAffectedProjectsByTarget[targetName] ?? [],
);

writeOutput('mode', 'release');
writeOutput('pr_base_sha', '');
writeOutput(
  'affected_projects_by_target_json',
  JSON.stringify(affectedProjectsByTarget),
);
writeOutput(
  'validate_targets_json',
  JSON.stringify(deployTargets),
);
writeOutput('deploy_targets_json', JSON.stringify(deployTargets));
writeOutput('any_scope', String(deployTargets.length > 0));
