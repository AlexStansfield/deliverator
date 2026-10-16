# Contributing

Thanks for taking an interest. A few notes to keep things smooth.

## Ground rules

- Keep the scope: Deliverator covers the things people do often across download clients. Deep,
  client-specific settings belong in the client's own UI.
- Every provider feature must be expressed through `ProviderAdapter` and `ProviderCapabilities`
  so the UI stays generic.
- Tests run against the in-memory mocks in `packages/server/src/mock`. Add to them rather than
  calling real services.

## Workflow

```bash
yarn install
yarn mock   # terminal 1
yarn dev                                  # terminal 2
yarn test && yarn typecheck               # before you push
```

Open a pull request against `main`. CI runs typecheck, tests and the Docker build.

## Reporting bugs

Include the Deliverator version (Settings → About), the client and its version, and the server log
around the time of the problem (`docker compose logs deliverator`). Redact URLs and keys.
