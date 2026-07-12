# Publishing

Maintainer guide for releasing `@pauldeng/node-red-contrib-protobuf`.

The steady-state release path is: tag a `vX.Y.Z` commit on `master`, push the tag, and let `.github/workflows/publish.yml` publish to npm with provenance via [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/). No long-lived npm token is stored in the repo.

## One-time bootstrap (v2.0.0)

Trusted Publishers can only be configured for a package that already exists on npm, so the first publish under the new scope needs a manual step. After v2.0.0 lands, every later release runs through the workflow with no further setup.

1. Confirm the working tree is clean and on `master`:

   ```bash
   git checkout master
   git pull --ff-only
   git status --short    # must be empty
   ```

2. Confirm version, lint, and full test matrix:

   ```bash
   grep '"version"' package.json    # should read 2.0.0
   npm ci
   npm run lint
   npm test
   npm run test:ui
   npm run test:docker
   npm pack --dry-run               # inspect the tarball file list
   ```

3. Publish v2.0.0 from your laptop:

   ```bash
   npm login                                  # interactive 2FA
   npm publish --access public                # provenance unavailable from laptop
   ```

   Provenance attestations require OIDC, which is only available inside GitHub Actions; the laptop publish therefore lands v2.0.0 without provenance. v2.0.1 onward will have it.

4. Tag the commit and push the tag so GitHub Releases tracks the version:

   ```bash
   git tag -a v2.0.0 -m "v2.0.0"
   git push origin master v2.0.0
   ```

5. Configure Trusted Publisher on npmjs.com:

   1. Sign in at <https://www.npmjs.com/>.
   2. Open the package page: <https://www.npmjs.com/package/@pauldeng/node-red-contrib-protobuf>.
   3. **Settings → Trusted Publishers → Add**:
      - Publisher: `GitHub Actions`
      - Repository owner: `pauldeng`
      - Repository name: `node-red-contrib-protobuf`
      - Workflow filename: `publish.yml`
      - Environment: leave blank
   4. Save.

6. Submit the package to the Node-RED Flow Library:

   - Visit <https://flows.nodered.org/add/node>.
   - Enter `@pauldeng/node-red-contrib-protobuf`.
   - The Flow Library does not auto-index from npm for first listings; subsequent versions refresh automatically.

## Steady-state release (v2.0.1+)

```bash
git checkout master
git pull --ff-only

# Bumps package.json + package-lock.json, commits, and creates a vX.Y.Z tag
npm version patch        # or 'minor' / 'major'

git push origin master --follow-tags
```

Pushing the `v*` tag triggers `publish.yml`:

1. Checks out the tagged commit, installs deps, runs `npm run lint` and `npm test`.
2. Runs the Playwright editor UI tests and packaged Node-RED Docker integration test.
3. Runs `npm publish --provenance --access public`. Trusted Publisher provides the OIDC token; no secret is needed.

After the workflow succeeds, confirm the new version appears on <https://www.npmjs.com/package/@pauldeng/node-red-contrib-protobuf> with a provenance badge, and that the listing on flows.nodered.org has refreshed. Flow Library indexing is checked after publish through the package page rather than by downloading an unpinned release-time CLI.

## Verification before tagging

Treat the steady-state path as immutable: npm publishes cannot be replaced once they exist. Catch problems before the tag.

| Check | Command |
| --- | --- |
| Lint | `npm run lint` |
| Unit + integration tests | `npm test` |
| Editor UI smoke tests | `npm run test:ui` |
| Packaged install (Docker) | `npm run test:docker` |
| Tarball contents | `npm pack --dry-run` |
| Publish dry run | `npm publish --dry-run` |

## Recovering from a bad release

Bumped a version and the published tarball is broken? Don't retag — `vX.Y.Z` is now immutable. Bump again:

```bash
npm version patch
git push origin master --follow-tags
```

If a published version is actively harmful, deprecate it on npm:

```bash
npm deprecate '@pauldeng/node-red-contrib-protobuf@X.Y.Z' 'Reason; upgrade to X.Y.Z+1'
```

`npm deprecate` does not remove the version but warns on install.
