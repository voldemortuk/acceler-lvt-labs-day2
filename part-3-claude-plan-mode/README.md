# Part 2 Lab — Plan Mode

**Time:** 60 minutes (30 real change + 20 flawed-plan drill + 10 pair critique). This is the lab portion only; the 75-min block in the [facilitator guide](../../README.md) opens with a 15-min live demo before the lab begins.

> Before starting this lab, run the [Plan Mode demo](demo/README.md) on the provided sample project. The demo walks the full Explore → Plan → Execute loop on a repo small enough that every step is visible. This lab then applies the same habit to the bootcamp repo.

## Part A — Drive a real change through plan mode (30 min)

1. From your Part 1 worksheet, pick one item you classified as "plan mode" (suggested defaults: item 3, 5, 9, or 12).
2. Open a fresh Claude Code session against the bootcamp repo. Engage plan mode.
3. Prompt for the change. **Do not approve the first plan.**
4. Use [plan-review-checklist.md](plan-review-checklist.md) to interrogate it.
5. Intervene at least once. Record v1 → v2 in your [worksheet](worksheet.md).
6. Approve and implement.
7. Commit on a branch called `lab/plan-mode-<initials>`.

### What to capture

- The plan v1 (paste).
- Your intervention (what you changed and why).
- The plan v2 (paste).
- One observation about how the final implementation matched (or didn't match) the plan.

## Part B — Flawed-plan drill (20 min)

1. Open [flawed-plan.md](flawed-plan.md).
2. Without running it, find the planted defects using [plan-review-checklist.md](plan-review-checklist.md).
3. There are **at least three** planted defects. Mark every issue you can defend — a real reviewer doesn't stop at a quota.
4. Facilitator reveals answers at minute 18.

## Part C — Pair critique (10 min)

Swap your Part A plans with your partner. Each side finds at least one issue in the other's plan and surfaces it to the room if novel.

## What "done" looks like

- A committed implementation on `lab/plan-mode-<initials>`.
- A [worksheet](worksheet.md) entry with plan v1, intervention, plan v2.
- At least three defects identified in the flawed plan, with citations to the section number.
- One critique exchanged with your pair.

---

**Facilitator only:** planted-defect answers and reveal sequencing are in [flawed-plan-answers.md](flawed-plan-answers.md). Do not distribute; reveal at minute 18 of Part B.
