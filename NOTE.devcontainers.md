# Dev Containers + Podman (Fedora) Notes

This repo currently uses a multi-container Dev Container (Compose) with Postgres + pgAdmin.
It is now also prepared to use a host rootless Podman socket from inside the
devcontainer through the Docker CLI.
On Fedora with rootless Podman + SELinux there are tradeoffs between:

- running the devcontainer as `root` vs `vscode`
- running `podman-compose` with a pod (default) vs without a pod (needed for `keep-id`)
- keeping files writable on a bind mount (usually requires `:Z` on SELinux)

Below are three supported approaches. I haven't picked one yet.

## Current Repo Setup

The active devcontainer build is [`.devcontainer/Dockerfile.debian-base`](/workspace/.devcontainer/Dockerfile.debian-base:1).

The repo now prepares Docker-compatible access to a host rootless Podman socket like this:

- installs the official Docker CLI packages from Docker's Debian repository:
  - `docker-ce-cli`
  - `docker-buildx-plugin`
  - `docker-compose-plugin`
- mounts the host `${XDG_RUNTIME_DIR}` into the devcontainer at `/run/host-user-runtime`
- exports `DOCKER_HOST=unix:///run/host-user-runtime/podman/podman.sock`
- does **not** install or run a Docker daemon inside the devcontainer

Manual host steps are still required:

- enable the user Podman socket on the host:
  - `systemctl --user enable --now podman.socket`
- make sure VS Code inherits `XDG_RUNTIME_DIR` from your login session
- rebuild/reopen the devcontainer after the image change

Quick verification inside the devcontainer after rebuild:

- `docker version`
- `docker info`
- `docker ps`
- `docker compose version`

If `XDG_RUNTIME_DIR` is not visible to the Dev Containers extension launch environment, the bind mount will not resolve correctly. In that case, launch VS Code from a shell that has the correct session environment or adjust your local VS Code launch environment before reopening the container.

## Option A: Pod + root (simplest / most stable on Podman)

Goal: "It just works" on Fedora/Podman with minimal moving parts.

- Keep Podman Compose default behavior (it creates a pod).
- Run the devcontainer as `root` (so bind-mount writes work without `keep-id`).
- Keep SELinux relabel on the workspace bind mount: `..:/workspace:rw,Z`.

Pros

- Lowest friction on Fedora/Podman (no `keep-id`, no pod tweaks).
- High Compose/Docker compatibility (Docker will run it too).

Cons

- Dev Container user is `root` (inside the container).

## Option B: No-pod + `keep-id` + `vscode` user (best UX, Podman-specific host tweak)

Goal: Restore `vscode` user while keeping bind mounts writable.

Key idea

- Rootless Podman needs `userns=keep-id` for the container user to map to your host UID.
- Podman disallows `--userns` inside a pod, so we must run Compose _without_ pods.

What changes

- Compose: run without pods
- Devcontainer service: `userns_mode: "keep-id"` and `user: vscode`
- Devcontainer config: `remoteUser=vscode`, `containerUser=vscode`
- Bind mount: keep `:Z` on SELinux

How to enforce "no-pod"

### B1) GNOME / session environment (host-wide for your user)

Set `PODMAN_COMPOSE_NO_POD=1` in your desktop session environment.
(Example: `~/.config/environment.d/*.conf`.)

### B2) Wrapper executable (workspace-local)

Create a wrapper that sets `PODMAN_COMPOSE_NO_POD=1` and then execs the docker CLI,
and point the Dev Containers extension at it via `dev.containers.dockerPath` (or the older
`remote.containers.dockerPath`).

Linux wrapper example: `.devcontainer/bin/docker`

```bash
#!/usr/bin/env bash
export PODMAN_COMPOSE_NO_POD=1
exec /usr/bin/docker "$@"
```

Windows note for the wrapper approach

- If you develop on Windows **via WSL2** (common for Dev Containers), the Dev Containers tooling
  typically runs in the WSL Linux environment, so the **Linux** wrapper works.
- If you develop on Windows **without** WSL, a bash wrapper will not run. You would need an
  OS-specific wrapper and OS-specific VS Code settings, for example:
  - `.devcontainer/bin/docker.cmd` for Windows
  - `.vscode/settings.json` with platform overrides:
    - `[windows]`: point `dev.containers.dockerPath` to the `.cmd`
    - `[linux]`: point it to the bash wrapper
      Also note: `PODMAN_COMPOSE_NO_POD` is specific to `podman-compose` (Python). Windows setups
      may use a different compose implementation, so the env var may not apply there.

Pros

- Cleanest day-to-day dev experience on Fedora/Podman (edit files as `vscode`).

Cons

- Requires a Podman-specific "no pod" configuration (env var or wrapper).

## Option C: No keep-id (ownership hacks / least recommended)

Goal: Run as `vscode` without `keep-id`.

Typical techniques

- Use Podman mount option `:U` (auto-chown) or manually `chown` the workspace to match the
  container user.

Pros

- Avoids the pod vs userns conflict.

Cons

- Can change ownership/permissions of files on the host (surprising, hard to undo, annoying in git).
