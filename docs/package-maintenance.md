# Package Maintenance

This document is for package authors maintaining the publishable drag-and-drop
packages in this pnpm workspace.

## Publishable Packages

- `@mk-drag-and-drop/dom`
- `@mk-drag-and-drop/react`

Both packages are intentionally marked `private: true` while release preparation
is still in progress. Remove `private: true` only as an intentional release step.

## Package Relationship

The React package wraps and depends on the DOM package. Build, pack, and publish
the DOM package first, then the React package.

The React source manifest can keep the workspace dependency:

```json
{
  "@mk-drag-and-drop/dom": "workspace:*"
}
```

Use pnpm for package packing and publishing. Do not use `npm pack` or
`npm publish` for these workspace packages. npm preserves `workspace:*` in the
packed manifest, while pnpm rewrites workspace dependencies to real package
versions in the packed manifest.

## Build Workflow

```sh
pnpm --filter @mk-drag-and-drop/dom build
pnpm --filter @mk-drag-and-drop/react... build
```

Both package build scripts clean `dist` before compiling. Do not edit `dist`
manually.

## Test Workflow

```sh
pnpm --filter @mk-drag-and-drop/dom test
pnpm --filter @mk-drag-and-drop/react test
pnpm --filter web build
pnpm --filter react-web build
```

The app builds are useful release confidence checks because the examples track
public package APIs.

## Pack Verification

Use a temporary directory outside the package source:

```sh
pnpm --filter @mk-drag-and-drop/dom build
pnpm --filter @mk-drag-and-drop/react... build

cd packages/mk-drag-and-drop/dom
pnpm pack --pack-destination <temp-dir>

cd ../react
pnpm pack --pack-destination <temp-dir>
```

Inspect the packed tarball contents, not only command output. For each tarball,
extract or list `package/package.json` and verify the packed manifest.

Checks:

- DOM packed manifest has no public dependency field containing `workspace:`.
- React packed manifest has no public dependency field containing `workspace:`.
- React packed manifest rewrites `@mk-drag-and-drop/dom` to a real semver
  version or range.
- Package contents include `package.json`, `README.md`, `LICENSE`, and
  `dist/**/*.js` plus `dist/**/*.d.ts`.
- Package contents do not include `src/**`.
- Package contents do not include stale `dist` files.
- Package contents do not include `*.map` files when source map emission is
  disabled.

## Metadata Checklist

Each publishable package should have:

- `version`
- `description`
- `license`
- `homepage`
- `repository`
- `bugs`
- `keywords`
- `publishConfig.access`

## Release Checklist

- Start from a clean working tree or an intentional release diff.
- Confirm `private: true` removal is intentional for the release.
- Run package tests.
- Run package builds.
- Run example builds.
- Pack DOM with pnpm and inspect the tarball.
- Pack React with pnpm and inspect the tarball.
- Verify the React tarball dependency rewrite for `@mk-drag-and-drop/dom`.
- Publish DOM first.
- Publish React second.
- Tag the release if that is the chosen release process.

## Maintenance Notes

- Do not edit `dist` manually.
- Do not add package source files to `files`.
- Keep public exports intentional.
- Keep examples useful, but secondary to package APIs.
- Update package READMEs when public APIs change.
- Keep React's DOM dependency aligned with the DOM package version before
  publishing.
