# Package Maintenance

This document is for package authors maintaining the publishable drag-and-drop
packages in this pnpm workspace.

## Publishable Packages

- `@mk-drag-and-drop/dom`
- `@mk-drag-and-drop/react`

Both packages are public npm packages and have been published under the
`@mk-drag-and-drop` scope. The package manifests should remain publishable and
must not be marked `private: true`.

## Package Relationship

The React package wraps and depends on the DOM package. Build, pack, and publish
the DOM package first, then the React package.

Keep the React package dependency on `@mk-drag-and-drop/dom` aligned with the
DOM package release version using a real semver range, for example:

```json
{
  "@mk-drag-and-drop/dom": "^0.3.0"
}
```

pnpm will still link the matching workspace package during local installs when
the workspace version satisfies the range.

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
pnpm install --lockfile-only
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
pnpm publish --dry-run

cd ../react
pnpm pack --pack-destination <temp-dir>
pnpm publish --dry-run
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

## Public API Guardrails

- Root application APIs must not expose runtime lifecycle controls such as
  `cleanup`, `dispose`, `update`, or broad overlay release methods.
- Public controller operations are `remeasureDropTargets` and
  `remeasureOverlay`.
- DOM binding helpers return `void`; do not add per-binding disposer returns.
- Manual overlay release is opt-in through `overlayRelease: "manual"` and the
  overlay-owned `removeOverlay` callback.
- Keep `@mk-drag-and-drop/dom/integration` scoped to adapter infrastructure.

## Metadata Checklist

Each publishable package should have:

- `version`
- `description`
- `license`
- `homepage`
- `repository`
- `bugs`
- `keywords`
- `type`
- `main`
- `types`
- `exports`
- `files`
- `sideEffects`
- `publishConfig.access`

## Release Checklist

- Start from a clean working tree or an intentional release diff.
- Confirm package manifests are not marked `private: true`.
- Run package tests.
- Run package builds.
- Run example builds.
- Run `pnpm install --lockfile-only` to verify lockfile consistency.
- Pack DOM with pnpm and inspect the tarball.
- Pack React with pnpm and inspect the tarball.
- Run `pnpm publish --dry-run` from each package directory.
- Verify the React tarball dependency rewrite for `@mk-drag-and-drop/dom`.
- Publish DOM first.
- Publish React second.
- Verify both packages on npm with `npm view`.
- Tag the release if that is the chosen release process.

## Maintenance Notes

- Do not edit `dist` manually.
- Do not add package source files to `files`.
- Keep public exports intentional.
- Keep examples useful, but secondary to package APIs.
- Update package READMEs when public APIs change.
- Keep React's DOM dependency aligned with the DOM package version before
  publishing.
