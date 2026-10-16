# Changelog

All notable changes to Deliverator are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Switched the package manager from pnpm to Yarn 4.
- `dev` is now the default branch; pushes to it publish a `:dev` Docker image.

## [0.1.1] - 2026-10-16

### Fixed

- qBittorrent 5.2+ login (`204` reply and `QBT_SID_<port>` cookie) was treated as a rejection.
- SABnzbd items already in history could not be deleted.
- Username and password fields misaligned on the provider edit form.

### Changed

- qBittorrent 401s now explain both likely causes (credentials or Host header validation).
- Duplicate torrents, unparseable links and unknown categories get plain error messages.

## [0.1.0] - 2026-10-16

### Added

- First release: unified downloads list for qBittorrent and SABnzbd, add by link or file,
  pause/resume/delete/reorder/retry, per-provider speed limits, live updates over SSE,
  six themes, sub-path hosting, single admin user, Docker image and CLI password reset.

[Unreleased]: https://github.com/AlexStansfield/deliverator/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/AlexStansfield/deliverator/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AlexStansfield/deliverator/releases/tag/v0.1.0
