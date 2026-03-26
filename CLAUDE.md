# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLI tool for bulk-configuring SIP timeout and auto-reboot settings on **Intelbras** and **Hikvision** intercoms. It scans a port range on target hosts to discover devices, reads their current SIP configuration via vendor-specific HTTP APIs (CGI for Intelbras, ISAPI/XML for Hikvision), and pushes updated settings. Both vendors use digest authentication.

## Commands

```bash
npm run build        # Compile TypeScript (npx tsc)
npm run start        # Run compiled output (node dist/src/index.js)
npm run dev          # Build + run in one step
```

### CLI flags

```bash
node dist/src/index.js -d <host>       # Target a single host (overrides DST_HOST)
node dist/src/index.js -r              # Read hosts from data/hosts.json
node dist/src/index.js -a              # Enable auto-reboot config (Intelbras only)
```

## Architecture

```
src/
  index.ts          # CLI entry point (commander). Parses args, loops over hosts.
  orchestrator.ts   # Workflow functions: runGetConfig, runSetConfig, runSetAutoMaintainReboot.
                    # Accepts a SipService/AutoMaintain object (vendor adapter) and delegates.
  types.ts          # Shared interfaces: DefaultResponse, HostConfig, SipService, AutoMaintain.
  utils.ts          # Logger (winston), file I/O helpers, UnknownError, p-limit concurrency wrapper.
  services/
    scan-ports.ts   # TCP port scanner (net.Socket). Scans startPort..endPort, saves open ports to JSON.
    intelbras.ts    # Intelbras adapter. CGI API with digest auth. Implements SipService + AutoMaintain.
    hikvision.ts    # Hikvision adapter. ISAPI XML API with digest auth. Implements SipService.
data/
  hosts.json        # Input: list of host addresses for --read-file mode.
  scan-ports.json   # Generated: open ports from last scan.
  hikvision.json    # Generated: Hikvision device SIP configs.
  intelbras.json    # Generated: Intelbras device SIP configs.
  combined.log      # Generated: winston log output.
```

### Key patterns

- **Vendor adapters**: `intelbras.ts` and `hikvision.ts` export objects conforming to the `SipService` interface. The orchestrator is vendor-agnostic.
- **Concurrency**: All HTTP requests use `p-limit(10)` via `promisesLimit()` in utils.
- **Data flow**: scan ports -> save open hosts to JSON -> read JSON to get/set SIP config per vendor -> save results to vendor JSON files.
- **HTTP client**: `urllib` with digest authentication for both vendors.
- **XML handling** (Hikvision only): `xml-js` for parsing responses, `xmlbuilder` for constructing PUT bodies.

## Environment Variables

Configured in `.env` (loaded via `dotenv/config`):

| Variable | Purpose |
|---|---|
| `START_PORT` / `END_PORT` | Port range for scanning (default 8084-8099) |
| `DST_HOST` | Default target host |
| `HIKVISION_USER` / `HIKVISION_PWD` | Hikvision digest auth |
| `INTELBRAS_USER` / `INTELBRAS_PWD` | Intelbras digest auth |
| `SIP_TIMEOUT_HIKVISION` | Desired SIP expiration for Hikvision devices |
| `SIP_TIMEOUT_INTELBRAS` | Desired SIP expiration for Intelbras devices |
| `SIP_SERVER` / `SIP_SERVER_PORT` | SIP server address/port (Hikvision XML body) |
| `SIP_PASSWORD` | SIP password (Hikvision XML body) |
| `SIP_ID` / `SIP_ENABLE` | SIP server ID and enable flag (Hikvision) |
| `AUTOREBOOTDAY` / `AUTOREBOOTENABLE` / `AUTOREBOOTHOUR` | Auto-reboot schedule (Intelbras) |

## Tech Stack

- **Runtime**: Node.js 24.13.0 (see `.nvmrc`)
- **Language**: TypeScript (ESM, `"type": "module"`, `NodeNext` module resolution)
- **No test framework configured** - no tests exist yet.
