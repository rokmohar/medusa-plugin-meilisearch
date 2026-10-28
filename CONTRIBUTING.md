# Contributing

Thanks for helping improve the Meilisearch plugin for Medusa. Bug reports, documentation fixes and pull requests are all
welcome. By taking part you agree to follow the [code of conduct](./CODE_OF_CONDUCT.md).

## Reporting issues

- **Bugs and feature requests:** open an [issue](https://github.com/rokmohar/medusa-plugin-meilisearch/issues/new/choose)
  using one of the templates. Include the plugin, Medusa, Meilisearch and Node versions.
- **Security vulnerabilities:** do not open a public issue. Follow the [security policy](./SECURITY.md).

## Development setup

Prerequisites:

- Node.js 22.12 or newer
- Yarn 4, enabled through Corepack: `corepack enable`
- A Meilisearch server, 1.20 or newer, for trying changes in an app. The README has a
  [docker-compose snippet](./README.md#docker-compose).

```bash
git clone https://github.com/rokmohar/medusa-plugin-meilisearch.git
cd medusa-plugin-meilisearch
yarn install
```

| Command          | What it does                                     |
| ---------------- | ------------------------------------------------ |
| `yarn build`     | Builds the plugin into `.medusa/server`          |
| `yarn dev`       | Rebuilds on change and republishes to local apps |
| `yarn test`      | Runs the unit tests in `tests/unit`              |
| `yarn lint`      | Lints `src` with ESLint                          |
| `yarn typecheck` | Type-checks the server and admin code            |
| `yarn format`    | Checks formatting with Prettier                  |

CI runs `format`, `lint`, `typecheck` and `test` on pushes to and pull requests against `main`; run them before you
open one.
`yarn format:fix` and `yarn lint:fix` fix most findings.

## Trying changes in a Medusa app

Medusa publishes plugins to a local registry with [yalc](https://github.com/wclr/yalc):

```bash
# in this repository
npx medusa plugin:publish

# in your Medusa application
npx medusa plugin:add @rokmohar/medusa-plugin-meilisearch
```

Then run `yarn dev` here: it rebuilds the plugin on every change and pushes it to the app.

## Pull requests

1. Fork the repository and branch off `main`.
2. Keep each pull request to one change, and add or update tests in `tests/unit` for behaviour changes.
3. Update the [README](./README.md) or [docs](./docs) when you change something users see, and add an entry under the
   unreleased version in [CHANGELOG.md](./CHANGELOG.md).
4. Write commit messages in the [Conventional Commits](https://www.conventionalcommits.org/) style: `feat:`, `fix:`,
   `docs:`, `chore:`, `ci:`.
5. Open the pull request against `main` and fill in the template.

## Releases

Releases are published by the maintainer with the manual **Publish** workflow. It builds the package, publishes it to
npm through trusted publishing, tags the commit and creates the GitHub release. Before running it, bump `version` in
`package.json` and date the version's section in the changelog.
