# Easter Egg Mode

Easter Egg Mode adds an optional isometric-themed narrative layer on top of existing Elastic Peek workflows. It is off by default and can be enabled in **Settings**.

When enabled, a floating overlay tracks your active location, quest objectives, and completion rewards. Core product workflows remain unchanged.

## Phases 1-3 coverage

- **Phase 1**: persisted `easterEggMode` setting, world-map metadata, and overlay shell.
- **Phase 2**: route-linked quests, progression state, objective completion controls, and sidebar discoverability while enabled.
- **Phase 3**: narrative reward moments and docs guidance.

## Accessibility and interaction expectations

The overlay is keyboard-operable and uses standard Material UI controls (`Button`, `Chip`, `MenuItem`) with explicit labels.

Quest completion requires either visiting specific pages or confirming task completion from the relevant page context.
