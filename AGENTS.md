# Elastic Peek

@README.md
@DEVELOPING.md
@CONTRIBUTING.md

## Automation Runtime

Runs are executed in non-interactive CI and state is ephemeral between runs.
Persist outcomes through safe outputs (comments/issues/PRs), because uncaptured local state is lost after the run.

## Application

See ./peek

## Common Commands

```bash
make setup   # install dependencies
make serve   # start dev server
make build   # production build
make lint    # Prettier + ESLint + TypeScript type checking
make format  # auto-format code with Prettier
make check   # run all checks then build (equivalent to CI)
```
