# CLAUDE.md

Guidance for Claude Code in this repository: a Three.js + TypeScript starter with the INVO game economy wired in. See README.md for setup.

## Commands

- Install: `npm ci`
- Type check: `npm run typecheck`
- Tests: `npm test`
- Build: `npm run build`

## Git push workflow (PCI DSS 6.5 / 6.2.3, 2026-11-17)

1. Never push straight to main. Work on a branch, push it, open a pull request. GitHub blocks direct pushes to main on this repository.
2. Every pull request and every push to main runs "AI security review" and "Tests" (`.github/workflows/pci-review-gate.yml`). Both must pass before merge.
3. A failed AI review means fix the code. Do not edit the workflow, the prompt, the severity rule or the verdict step to get a pass, and do not re-run hoping for a different answer.
4. Pull requests from forks get no secrets, so the review cannot run on them and the check stays red. A maintainer re-opens the change from a branch in this repository.
5. Changes to `.github/workflows` go through the same pull request and review as any other change, and are called out in the pull request description.
6. Never commit or print secrets or tokens. `CLAUDE_CODE_OAUTH_TOKEN` lives in Secret Manager and repository secrets only.
7. Keep the review artifacts (`ai-security-review-<sha>`). They are the PCI change-review record (90 days on a public repository, GitHub's cap).
