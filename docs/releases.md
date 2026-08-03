# Release process

Kizuna uses Changesets for Semantic Versioning and changelog entries.
The current release channel is `rc`.

## Add a package change

Run this command before you open a pull request:

```bash
pnpm changeset
```

Select one bump type:

- `patch` fixes a defect without breaking the public API.
- `minor` adds a backward-compatible feature.
- `major` changes the public API in an incompatible way.

Write a short summary for package users. Changesets adds this summary to
`CHANGELOG.md` during version preparation.

A documentation-only or test-only change does not need a changeset when it
does not affect package users.

## Prepare a version

The release workflow runs after a change reaches `main`. It prepares the
`changeset-release/main` branch. It creates a pull request when repository
permissions allow this action.

Otherwise, open a pull request from `changeset-release/main` to `main`
manually. Use `Release packages (rc)` as the title for a release candidate.

That pull request performs these actions:

1. It applies the highest required SemVer bump.
2. It updates `package.json` and `CHANGELOG.md`.
3. It copies the version to `jsr.json`.
4. In RC mode, it records consumed changesets in `.changeset/pre.json`.

Changesets keeps the consumed files during RC mode. It removes them when the
project leaves prerelease mode.

Review and merge that pull request when the release is ready.

## Publish to npm

The GitHub workflow does not publish packages. A maintainer publishes the
reviewed version with this command:

```bash
pnpm release
```

This command builds the package before Changesets publishes it to npm.

## Finish the release candidate phase

Do not exit prerelease mode for a normal release candidate. When Kizuna is
ready for stable `1.0.0`, run these commands on a dedicated release change:

```bash
pnpm changeset pre exit
pnpm version-packages
```

Review the generated version and changelog before you commit them.
