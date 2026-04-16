# Contributing to OpenFrame

Thanks for taking the time to contribute to OpenFrame.
This guide explains where contributions are most useful, how to prepare a pull request, and which project conventions are required.

## Ways to Contribute

You can contribute in several ways:

- Fix bugs in existing behavior.
- Improve reliability, safety, and performance.
- Build features that align with product goals.
- Improve documentation in [README.md](README.md) and related in-repo docs.
- Add tests and increase confidence for risky paths.

## What To Work On

Good places to contribute:

- API routes in [app/api](app/api)
- Auth and access control in [lib/auth.ts](lib/auth.ts) and [lib/route-access.ts](lib/route-access.ts)
- API response consistency in [lib/api-response.ts](lib/api-response.ts)
- Data model and migrations in [prisma/schema.prisma](prisma/schema.prisma) and [prisma/migrations](prisma/migrations)
- Video review UI in [components/video-page](components/video-page)
- Operational and setup docs in [README.md](README.md)

If your change is large, open an issue first so scope can be aligned.

## Local Setup

1. Install dependencies:

```bash
bun install
```

2. Copy environment file and set required values:

```bash
cp .env.example .env
```

3. Ensure Prisma client is generated:

```bash
bun run db:generate
```

4. Run validation:

```bash
bun run check
```

Optional helpful commands:

```bash
bun run db:push
bun run db:migrate
bun run db:seed
```

## Contribution Workflow

1. Fork and create a branch from `main`.
2. Keep changes focused on one logical concern.
3. Follow coding and architecture conventions in this guide.
4. Run required validation locally.
5. Open a PR with a clear description and checklist.

## Branch Naming

Use one of these prefixes:

- `feature/<short-topic>`
- `fix/<short-topic>`
- `docs/<short-topic>`
- `refactor/<short-topic>`
- `chore/<short-topic>`

Examples:

- `feature/approval-request-filters`
- `fix/share-link-password-validation`
- `docs/contributing-guide`

## Commit and PR Title Standard

Use Conventional Commits style:

- `feat: add workspace invite resend endpoint`
- `fix: prevent guest comment without share permission`
- `docs: add contribution workflow examples`
- `refactor: simplify project access checks`

Recommended pattern:

```text
type(scope): short summary
```

Examples:

- `feat(api): add comment export pagination`
- `fix(auth): block unverified credential sign-in`

## Required Checks Before Opening a PR

You should run:

```bash
bun run check
```

If you changed [prisma/schema.prisma](prisma/schema.prisma), also run:

```bash
bun run db:generate
```

Also verify:

- No unrelated file changes are included.
- No secrets or private keys are committed.
- Docs are updated when behavior changes.

## Project Conventions (Must Follow)

### Package and scripts

- Use Bun commands only for dependency and script workflows.
- Keep lockfile changes intentional and minimal.

### Auth and authorization

- Server-side session reads: use `auth()` from [lib/auth.ts](lib/auth.ts).
- Access checks: use `checkProjectAccess()` / `checkWorkspaceAccess()`.
- Do not implement ad-hoc role checks when shared helpers exist.

### API responses

- Use `successResponse` / `apiErrors` from [lib/api-response.ts](lib/api-response.ts).
- Keep error messages specific but safe.

### Dynamic route params

In App Router dynamic routes, keep `params` typed as `Promise<...>` and use `await params`.

### Database write safety

- For multi-step DB writes, use Prisma transactions.
- Prefer backward-compatible API changes unless a breaking change is explicitly required.
- If custom SQL is needed, manage it in migration SQL files under [prisma/migrations](prisma/migrations).

### Imports

- Prefer `@/` alias imports when available.

## Database Change Guidelines

When changing data model behavior:

1. Update [prisma/schema.prisma](prisma/schema.prisma).
2. Generate Prisma client (`bun run db:generate`).
3. Add/update migration files as needed under [prisma/migrations](prisma/migrations).
4. Validate affected endpoints and access-control paths.
5. Include migration notes in the PR description.

## Frontend Change Guidelines

- Preserve existing UI patterns and information architecture.
- Keep components focused; extract reusable logic into hooks/services.
- Avoid unrelated visual churn in functional PRs.
- Ensure desktop and mobile behavior remains usable.

## Documentation Change Guidelines

- Primary project docs: [README.md](README.md)
- For technical changes, document behavior in the most relevant existing file or PR notes.
- Keep docs practical and update them in the same PR when behavior changes.

## Pull Request Checklist

Before submitting, confirm:

- [ ] My branch is focused on one concern.
- [ ] I followed project conventions in this guide.
- [ ] I ran `bun run check`.
- [ ] I ran `bun run db:generate` if schema changed.
- [ ] I updated docs for user-visible or architectural changes.
- [ ] I added screenshots or request/response examples when useful.
- [ ] My PR description explains what changed and why.

## PR Description Template (Recommended)

```markdown
## Summary

Short description of what changed.

## Why

What problem this solves.

## Changes

- Key change 1
- Key change 2

## Validation

- bun run check
- Manual test notes

## Notes

Any migration, compatibility, or follow-up notes.
```

## Review Expectations

Maintainers will usually review for:

- Correctness and regressions
- Security and access control
- API contract compatibility
- Code clarity and maintainability
- Operational safety (migrations, cleanup impact)

Please be responsive to review comments and keep follow-up commits scoped.

## Security Issues

Do not open public issues for security vulnerabilities.
Please follow [SECURITY.md](SECURITY.md).

## Code of Conduct

Please follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Need Help?

If you are unsure where to start, open an issue with context and a proposed approach.
Maintainers can help you scope the change before implementation.
