# Part 3 Worksheet — Spec-Driven Development

Fill this in during the Part 3 lab. Keep it open in a split editor or print it. Write in it.

## Exercise 3.1 — Read the PRD

Open [prd-webhook-retries.md](prd-webhook-retries.md).

List three things the PRD does **not** answer:

1.
2.
3.

## Exercise 3.2 — Write the spec

Use [spec-template.md](spec-template.md). Commit it as `spec.md` on your `running-build/<initials>` branch.

Check off the spec-quality items in [spec-quality-checklist.md](spec-quality-checklist.md).

## Exercise 3.3 — Implement, then iterate the spec once

Run the agent against the spec. As gaps surface, **patch the spec first, then re-run.** Do not patch the code without patching the spec.

| Spec gap | Defect that surfaced | Fix in spec |
|---|---|---|
| | | |
| | | |
| | | |

For each row above, be able to say out loud in one sentence: *"This defect traces to this spec gap."*

## Exercise 3.4 — Lock the running build

- [ ] `spec.md` committed
- [ ] Implementation committed on `running-build/<initials>`
- [ ] At least one acceptance test passing
- [ ] Branch pushed
