import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;

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

function parseBoolean(value) {
  return value === '1' || value === 'true';
}

function hasGitCommit(ref) {
  try {
    run('git', ['rev-parse', '--verify', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveBaseSha(inputValue, tagName) {
  if (inputValue) {
    if (!hasGitCommit(inputValue)) {
      throw new Error(
        `The provided base SHA or ref "${inputValue}" for ${tagName} could not be resolved locally.`,
      );
    }

    return run('git', ['rev-parse', `${inputValue}^{commit}`]);
  }

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

function joinTargets(targets) {
  return targets.join(',');
}

const eventName = process.env.GITHUB_EVENT_NAME ?? '';
const forceServer = parseBoolean(process.env.FORCE_SERVER ?? 'false');
const forceWebapp = parseBoolean(process.env.FORCE_WEBAPP ?? 'false');
const serverBaseOverride = process.env.SERVER_BASE_SHA_OVERRIDE ?? '';
const webappBaseOverride = process.env.WEBAPP_BASE_SHA_OVERRIDE ?? '';

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

  writeOutput('mode', 'pull_request');
  writeOutput('pr_base_sha', normalizedBaseSha);
  writeOutput('pr_affected_projects_json', JSON.stringify(affectedProjects));
  writeOutput('validate_server', String(projectSetContains(affectedProjects, 'server')));
  writeOutput('validate_webapp', String(projectSetContains(affectedProjects, 'webapp')));
  writeOutput('deploy_server', 'false');
  writeOutput('deploy_webapp', 'false');
  writeOutput('server_base_sha', '');
  writeOutput('webapp_base_sha', '');
  writeOutput('server_affected_projects_json', '[]');
  writeOutput('webapp_affected_projects_json', '[]');
  writeOutput(
    'any_scope',
    String(projectSetContains(affectedProjects, 'server') || projectSetContains(affectedProjects, 'webapp')),
  );
  process.exit(0);
}

const currentHeadSha = run('git', ['rev-parse', 'HEAD^{commit}']);
const targetServerOnly =
  eventName === 'workflow_dispatch' &&
  forceServer &&
  !forceWebapp &&
  !webappBaseOverride;
const targetWebappOnly =
  eventName === 'workflow_dispatch' &&
  forceWebapp &&
  !forceServer &&
  !serverBaseOverride;

const serverBaseSha = targetWebappOnly
  ? currentHeadSha
  : resolveBaseSha(serverBaseOverride, 'deploy/prod/server');
const webappBaseSha = targetServerOnly
  ? currentHeadSha
  : resolveBaseSha(webappBaseOverride, 'deploy/prod/webapp');

const serverAffectedProjects = serverBaseSha ? rushAffectedProjects(serverBaseSha) : [];
const webappAffectedProjects = webappBaseSha ? rushAffectedProjects(webappBaseSha) : [];

const deployServer =
  forceServer ||
  !serverBaseSha ||
  projectSetContains(serverAffectedProjects, 'server');
const deployWebapp =
  forceWebapp ||
  !webappBaseSha ||
  projectSetContains(webappAffectedProjects, 'webapp');

const releaseTargets = [];
if (deployServer) {
  releaseTargets.push('server');
}
if (deployWebapp) {
  releaseTargets.push('webapp');
}

writeOutput('mode', 'release');
writeOutput('pr_base_sha', '');
writeOutput('pr_affected_projects_json', '[]');
writeOutput('server_base_sha', serverBaseSha);
writeOutput('webapp_base_sha', webappBaseSha);
writeOutput(
  'server_affected_projects_json',
  JSON.stringify(serverAffectedProjects),
);
writeOutput(
  'webapp_affected_projects_json',
  JSON.stringify(webappAffectedProjects),
);
writeOutput('validate_server', String(deployServer));
writeOutput('validate_webapp', String(deployWebapp));
writeOutput('deploy_server', String(deployServer));
writeOutput('deploy_webapp', String(deployWebapp));
writeOutput('release_targets', joinTargets(releaseTargets));
writeOutput('any_scope', String(releaseTargets.length > 0));
