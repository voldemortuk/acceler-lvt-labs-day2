# Spec Quality Checklist

Run through this before committing a spec. If any item is unchecked, the spec is not yet executable.

## Structure

- [ ] Spec fits on one page (two at the absolute most).
- [ ] All six required sections present: context, scope, acceptance criteria, constraints, non-goals, definition of done.
- [ ] Links to PRD and any existing tech spec (don't restate them).

## Acceptance criteria

- [ ] Each AC is testable. A reader can imagine the test without asking.
- [ ] Each AC describes **observable behavior**, not internal implementation.
- [ ] No AC contains the word "should" without a follow-on condition.
- [ ] At least one AC covers the **failure path** (what happens when something goes wrong).

## Constraints

- [ ] Constraints that aren't obvious from the PRD are stated explicitly.
- [ ] Performance constraints are quantified (numbers, not adjectives).
- [ ] Security defaults are named, not assumed.

## Non-goals

- [ ] At least two non-goals listed. (If you can't think of any, your scope is unclear.)
- [ ] Non-goals include anything a reasonable reader might assume in.

## Definition of done

- [ ] Lists every gate: tests, lint, type-check, docs, telemetry.
- [ ] Each gate is one a CI job or human reviewer can mechanically check.

## The "agent test"

Re-read the spec as if you were the agent.

- [ ] Could you build this without asking a single clarifying question?
- [ ] If you generated something wrong, would the spec tell you it was wrong?

If either answer is no, the spec has a gap.
