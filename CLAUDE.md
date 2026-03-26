# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLI tool and Node.js library for managing **Intelbras**, **Hikvision**, and **Khomp** intercoms. It scans port ranges on target hosts to discover devices, reads SIP configuration via vendor-specific HTTP APIs (CGI for Intelbras, ISAPI/XML for Hikvision), pushes updated settings, and collects real-time device inventory. Both vendors use digest authentication. Khomp devices have no API and are detected by elimination.

## Commands

```bash
npm run build        # Compile TypeScript (npx tsc)
npm run start        # Run compiled output (node dist/src/index.js)
npm run dev          # Build + run in one step
npm test             # Run tests (vitest)
npm run test:watch   # Run tests in watch mode
```

### CLI flags

```bash
node dist/src/index.js -d <host>       # Target a single host (overrides DST_HOST)
node dist/src/index.js -r              # Read hosts from data/hosts.json
node dist/src/index.js -a              # Enable auto-reboot config (Intelbras only)
node dist/src/index.js -i              # Query device inventory (prints JSON to stdout)
node dist/src/index.js -i -d <host>    # Inventory for a single host
node dist/src/index.js -i -r           # Inventory for all hosts in hosts.json
```

## Architecture

```
src/
  index.ts            # CLI entry point (commander). Parses args, loops over hosts.
  orchestrator.ts     # Workflow functions: runGetConfig, runSetConfig, runSetAutoMaintainReboot.
                      # Accepts SipService/AutoMaintain objects and delegates.
  types.ts            # Shared interfaces: DefaultResponse, HostConfig, SipService, AutoMaintain.
  utils.ts            # Logger (winston), validation helpers, UnknownError, p-limit wrapper.
  services/
    scan-ports.ts     # TCP port scanner (net.Socket). Exports scanPort and scanPortList.
    intelbras.ts      # Intelbras SIP adapter. CGI API with digest auth.
    hikvision.ts      # Hikvision SIP adapter. ISAPI XML API with digest auth.
  inventory/
    index.ts          # Barrel re-exports: queryCondominium, queryDevice, types.
    types.ts          # Inventory interfaces: DeviceInventory, CondominiumInventory, etc.
    query.ts          # Orchestration: queryCondominium (scan+detect+collect), queryDevice.
    detect-vendor.ts  # Vendor detection: probe Intelbras -> Hikvision -> Khomp fallback.
    intelbras-inventory.ts  # Intelbras CGI inventory adapter (7 endpoints, read-only).
    hikvision-inventory.ts  # Hikvision ISAPI inventory adapter (4 endpoints, read-only).
    __tests__/        # Vitest unit tests for all inventory modules.
  __tests__/          # Vitest unit tests for utils and scan-ports.
data/
  hosts.json          # Input: list of host addresses for --read-file mode.
  combined.log        # Generated: winston log output.
docs/
  api-intelbras.md    # Intelbras CGI endpoint documentation with response examples.
  api-hikvision.md    # Hikvision ISAPI endpoint documentation with response examples.
```

### Key patterns

- **Vendor adapters**: `intelbras.ts` and `hikvision.ts` export objects conforming to the `SipService` interface. The orchestrator is vendor-agnostic.
- **In-memory data flow**: All data passes between pipeline steps in memory (no intermediate JSON files). Port scan results, configs, and inventory are passed as function parameters.
- **Concurrency**: All HTTP requests use `p-limit(10)` via `promisesLimit()` in utils.
- **HTTP client**: `urllib` with digest authentication for both vendors.
- **XML handling** (Hikvision only): `xml-js` for parsing responses, `xmlbuilder` for constructing PUT bodies.
- **Inventory module**: Exported as a Node.js library (`import { queryCondominium } from 'setup-sip-timeout-intercom/inventory'`). Credentials are passed as parameters, not read from env.

### Library usage (Slack bot integration)

```typescript
import { queryCondominium, queryDevice } from 'setup-sip-timeout-intercom/inventory'

const result = await queryCondominium({
  host: 'ddns.example.codeseg.io',
  startPort: 8084,
  endPort: 8099,
  credentials: {
    intelbras: { user: 'admin', password: 'secret' },
    hikvision: { user: 'admin', password: 'secret' },
  },
})
// Returns: CondominiumInventory { host, queriedAt, devices[], errors[] }
```

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
- **Testing**: Vitest (unit tests in `__tests__/` directories)
