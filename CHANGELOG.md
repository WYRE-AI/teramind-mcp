# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

Per-version release notes for tagged releases are published on the [GitHub Releases page](https://github.com/WYRE-AI/teramind-mcp/releases) - `semantic-release` generates them from commit history at release time.

## [Unreleased]

### Added

- Initial v1 release: 16 read-only, non-content-capture tools covering computer inventory, agent (user) inventory, department metadata, alerts, anomaly-rule and behavior-policy configuration, monitoring-profile metadata, and account identity. `x-access-token` JWT authentication (self-generated in the Teramind dashboard's Access Tokens menu) plus a per-customer instance URL (Teramind's API has no shared multi-tenant base URL). **PII-dense by nature (insider-threat/employee-monitoring product) - requires security review before merge into Conduit.** See README's Scope and Credential scope sections for the full accounting of excluded screen-recording/keystroke/email-content/video-playback endpoints and the token-permission-inheritance finding.
