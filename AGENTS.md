# AGENTS.md

## Project policy

- This extension has not been publicly released yet.
- Before public release, do not add or preserve backward-compatibility logic for older versions, older saved settings, or migration paths unless the user explicitly asks for it.
- If old-version compatibility logic increases complexity, obscures runtime behavior, or slows down cleanup work, prefer deleting it.
- Optimize for current behavior correctness and code clarity over pre-release migration support.

## Practical implication for this repository

- Legacy settings cleanup code is not automatically valuable just because it exists.
- If a cleanup bridge, migration helper, or stored-settings compatibility path only exists to support unreleased historical builds, it is a removal candidate.
- When updating planning docs, keep them aligned with this pre-release policy.
