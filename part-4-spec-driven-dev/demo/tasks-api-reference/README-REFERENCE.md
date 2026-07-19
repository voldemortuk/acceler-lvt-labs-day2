# tasks-api-reference — Spec Kit reference scaffold

This folder is the **untouched output** of:

```powershell
uvx --from git+https://github.com/github/spec-kit.git specify init tasks-api-reference --integration claude --script ps
```

run on 2026-07-01 against Spec Kit v0.12.3.dev0.

It is committed to this repo so learners doing the [Spec-Driven demo](../README.md) can compare their own scaffold to a known-good one. **Do not run further Spec Kit skills (`/speckit-specify`, etc.) against this folder** — those will mutate it and destroy its value as a reference.

## What's in here

| Path | Purpose |
|---|---|
| `.claude/skills/speckit-*/SKILL.md` | The ten Spec Kit skills registered with Claude Code |
| `.specify/memory/` | Where `constitution.md` will live once generated |
| `.specify/templates/` | Canonical spec, plan, tasks, and constitution templates the skills expand |
| `.specify/scripts/` | PowerShell (or bash) helpers the skills invoke |
| `.specify/workflows/`, `.specify/integrations/` | Toolkit metadata; you don't touch these directly |
| `.specify/init-options.json` | Records the flags this scaffold was created with |

## When to regenerate this reference

Only when the Spec Kit CLI ships a materially new scaffold layout. To regenerate:

```powershell
Remove-Item -Recurse -Force .\tasks-api-reference
uvx --from git+https://github.com/github/spec-kit.git specify init tasks-api-reference --integration claude --script ps --ignore-agent-tools
```

Then update the version line at the top of this file and the [demo README](../README.md).
