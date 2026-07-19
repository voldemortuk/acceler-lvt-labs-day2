# Spec Template

> Keep it short. One page is a good target. Two pages is the upper bound for one feature. If you need more, you have a feature that should be split.

## 1. Context

- One paragraph: what is being built and why.
- Link to the PRD and any existing tech spec.

## 2. Scope

- Bulleted list of what is in scope, written as user- or system-visible behavior.

## 3. Acceptance criteria

> Each criterion must be testable. If you cannot imagine the test, the criterion is not specific enough.

- [ ] AC1 — `<observable behavior>`
- [ ] AC2 — `<observable behavior>`
- [ ] AC3 — `<observable behavior>`

## 4. Constraints

- Technical, performance, security, or compatibility constraints.
- Includes anything the agent must obey but a reader of the PRD wouldn't know.

## 5. Non-goals

- Things explicitly out of scope.
- Things a reasonable reader might assume in but you are not building.

## 6. Definition of done

- All acceptance criteria pass automated tests.
- `<insert other gates: lint, type-check, security skill, review>`
- Documentation: `<list what is updated and where>`
- Telemetry / observability: `<list new logs, metrics, or events>`

## Optional sections (use sparingly)

### 7. Interfaces

- Public types, function signatures, HTTP routes, or event shapes the rest of the system will see. Treat as a contract.

### 8. Open questions

- Anything you want to flag rather than guess. The agent may not see these.
