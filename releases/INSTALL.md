# AgentiQ SDK Installation Guide

## Install via npm (after publication)

```bash
npm i @qriptoagentiq/core-client@^0.1.5 @qriptoagentiq/kn0w1-client@^0.1.5
# Peer dependency:
npm i @supabase/supabase-js@^2.75.0
```

## Install via tarballs (immediate)

For immediate installation before npm publication:

```bash
npm i ./releases/qriptoagentiq-core-client-0.1.5.tgz ./releases/qriptoagentiq-kn0w1-client-0.1.5.tgz
# Peer dependency:
npm i @supabase/supabase-js@^2.75.0
```

## Verify Installation

```bash
# Check installed versions
npm ls @qriptoagentiq/core-client @qriptoagentiq/kn0w1-client

# Verify package integrity (if SHA256SUMS.txt is available)
shasum -a 256 -c SHA256SUMS.txt
```

## Usage Example

```typescript
import { initAgentiqClient } from "@qriptoagentiq/core-client";
import { Kn0w1Client } from "@qriptoagentiq/kn0w1-client";

// Initialize core client
const core = initAgentiqClient({
  url: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY
});

// Ensure IAM user
await core.ensureIamUser();

// Initialize Kn0w1 client
const kn0w1 = new Kn0w1Client(core, {
  tenantId: "your-tenant-id",
  siteId: "your-site-id"
});

// Fetch feed
const feed = await kn0w1.feed(20);
```

## Packages Included

- **@qriptoagentiq/core-client** (v0.1.5): Core SDK with authentication, upload, storage, and sharing capabilities
- **@qriptoagentiq/kn0w1-client** (v0.1.5): Kn0w1-specific client for feed and post management
- **@qriptoagentiq/a2a-client** (v0.1.5): Agent-to-Agent communication client (scaffold)

## Requirements

- Node.js 18+ or modern browser with ES2020+ support
- @supabase/supabase-js ^2.75.0 (peer dependency)
