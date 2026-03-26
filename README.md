# Setup Intercom

CLI tool and Node.js library for managing **Intelbras**, **Hikvision**, and **Khomp** intercoms. Scans port ranges to discover devices, reads/writes SIP configuration via vendor APIs, and provides real-time device inventory queries.

## Tech Stack

- **Node.js 24** & **TypeScript** (ESM)
- **urllib** - HTTP client with digest authentication
- **winston** - Structured logging with file rotation
- **p-limit** - Concurrency control (max 10 parallel requests)
- **vitest** - Unit testing framework

## Setup

```bash
nvm use                 # Use Node.js version from .nvmrc
npm install             # Install dependencies
cp .env.example .env    # Configure credentials (see below)
```

## Usage

### SIP Configuration (existing functionality)

```bash
npm run dev -- -d 192.168.1.50           # Configure single host
npm run dev -- -r                         # Configure all hosts from data/hosts.json
npm run dev -- -r -a                      # Configure + set auto-reboot (Intelbras only)
```

### Device Inventory (new)

```bash
npm run dev -- -i -d ddns.example.com     # Query inventory for single host
npm run dev -- -i -r                      # Query inventory for all hosts
```

Outputs JSON with device details: model, firmware, serial, MAC, SIP extension, LAN IP, datetime, auto-reboot status.

### CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-d, --dst-host <host>` | Target host address | `DST_HOST` from `.env` |
| `-r, --read-file` | Read hosts from `data/hosts.json` | - |
| `-a, --auto-reboot` | Set auto-reboot on Intelbras devices | - |
| `-i, --info` | Query device inventory (JSON output) | - |

## Library Usage (Slack Bot Integration)

The inventory module can be imported directly by other Node.js projects:

```typescript
import { queryCondominium, queryDevice } from 'setup-sip-timeout-intercom/inventory'

// Query all devices at a condominium
const result = await queryCondominium({
  host: 'ddns.example.com',
  startPort: 8084,
  endPort: 8099,
  credentials: {
    intelbras: { user: 'admin', password: 'secret' },
    hikvision: { user: 'admin', password: 'secret' },
  },
})

// Query a single known device
const device = await queryDevice({
  address: 'ddns.example.com:8084',
  credentials: {
    intelbras: { user: 'admin', password: 'secret' },
    hikvision: { user: 'admin', password: 'secret' },
  },
})
```

### Vendor Detection

Devices are identified automatically:
1. **Intelbras** - responds to CGI `/cgi-bin/magicBox.cgi?action=getDeviceType`
2. **Hikvision** - responds to ISAPI `/ISAPI/System/deviceInfo`
3. **Khomp** - port is open but neither API responds (no data available, only port recorded)

## Project Structure

```
src/
  index.ts                # CLI entry point (commander)
  orchestrator.ts         # SIP config workflow orchestration
  types.ts                # Shared interfaces
  utils.ts                # Logger, validation, concurrency helpers
  services/
    scan-ports.ts         # TCP port scanner
    intelbras.ts          # Intelbras SIP config adapter (CGI)
    hikvision.ts          # Hikvision SIP config adapter (ISAPI XML)
  inventory/
    index.ts              # Public API exports
    types.ts              # Inventory-specific interfaces
    query.ts              # queryCondominium, queryDevice orchestration
    detect-vendor.ts      # Vendor probe logic
    intelbras-inventory.ts  # Intelbras device info collector (7 CGI endpoints)
    hikvision-inventory.ts  # Hikvision device info collector (4 ISAPI endpoints)
data/
  hosts.json              # Input: host addresses for --read-file mode
docs/
  api-intelbras.md        # Intelbras API endpoint documentation
  api-hikvision.md        # Hikvision API endpoint documentation
```

### hosts.json format

```json
{
  "hosts": ["ddns.condo1.example.com", "ddns.condo2.example.com"]
}
```

## Environment Variables

Create a `.env` file from `.env.example`:

```bash
# General
START_PORT=8084
END_PORT=8099
DST_HOST='localhost'

# Hikvision
HIKVISION_USER='admin'
HIKVISION_PWD='changeme'
SIP_TIMEOUT_HIKVISION=15
SIP_ID=1
SIP_ENABLE=true
SIP_SERVER='sip.example.com'
SIP_SERVER_PORT=7060
SIP_PASSWORD='changeme'

# Intelbras
INTELBRAS_USER='admin'
INTELBRAS_PWD='changeme'
SIP_TIMEOUT_INTELBRAS=60
AUTOREBOOTDAY=7
AUTOREBOOTENABLE=true
AUTOREBOOTHOUR=4
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Run in watch mode
```

## Development

```bash
npm run build         # Compile TypeScript
npm run start         # Run compiled output
npm run dev           # Build + run
```
