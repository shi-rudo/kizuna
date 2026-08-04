# Release process

Kizuna uses Changesets for Semantic Versioning and changelog entries.
The current release channel is `rc`.

## Publication targets

The automated publication target is npm only.

- Release candidate versions such as `1.0.0-rc.8` use the npm `rc` dist-tag.
- Stable versions such as `1.0.0` use the npm `latest` dist-tag.
- JSR is not an automated publication target. `jsr.json` keeps the same version
  as `package.json`, but the workflow does not publish or check a remote JSR
  package.

After the release step, the workflow compares these values:

- the versions in `package.json` and `jsr.json`;
- the exact version on npm;
- the expected npm dist-tag;
- the publication result from the Changesets action.

The workflow fails if these values do not agree.

## Configure npm trusted publishing

An npm package owner must configure this once in the package settings for
`@shirudo/kizuna`:

- Publisher: GitHub Actions
- Organization or user: `shi-rudo`
- Repository: `kizuna`
- Workflow filename: `release.yml`
- Environment: `npm`
- Allowed action: `npm publish`

Do not add an `NPM_TOKEN` write secret. The workflow uses a short-lived GitHub
OIDC identity. It runs on Node.js 24 and uses npm CLI to publish. npm creates
provenance for this public package and repository.

The GitHub Environment named `npm` allows only the `main` branch. The npm
Trusted Publisher requires the same environment name. A workflow from another
branch therefore cannot obtain the accepted publishing identity.

If the npm settings do not match, publication fails with an authentication or
registry error. npm checks this configuration only during publication.

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

A documentation-only, test-only, or release-infrastructure change does not need
a changeset when it does not affect package users.

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

When no unconsumed changeset remains, the release workflow builds the package
and publishes an npm version that does not exist yet. It uses `rc` or `latest`
as described above. A missing trusted-publisher configuration, an npm error, or
a failed registry check makes the workflow fail.

The `pnpm release` command is for the trusted GitHub workflow. It requests npm
provenance and is not the local emergency command.

## Emergency publication

First, rerun the `Release` workflow from the GitHub Actions page. The
`workflow_dispatch` trigger uses the same OIDC identity, provenance, checks,
and dist-tag rules as the normal run.

Use a local publication only when GitHub Actions is unavailable. This path
requires a maintainer npm login with two-factor authentication. It does not
produce GitHub Actions provenance.

1. Check out the exact release commit. Confirm that the worktree is clean.
2. Confirm that the version is not already on npm.
3. Install dependencies and build the package.
4. Publish with the correct dist-tag.
5. Check the version and all dist-tags.

For a release candidate, run:

```bash
release_version=1.0.0-rc.8
npm view "@shirudo/kizuna@$release_version" version
pnpm install --frozen-lockfile
pnpm build
npm publish --access public --tag rc
npm view "@shirudo/kizuna@$release_version" version
npm view @shirudo/kizuna dist-tags
```

For a stable version, replace `--tag rc` with `--tag latest`. Never publish a
different version from the one in `package.json` and `jsr.json`.

## Finish the release candidate phase

Do not exit prerelease mode for a normal release candidate. When Kizuna is
ready for stable `1.0.0`, run these commands on a dedicated release change:

```bash
pnpm changeset pre exit
pnpm version-packages
```

Review the generated version and changelog before you commit them.
