# QubeBase - Project Overview

## Purpose
QubeBase is a production-grade, multi-tenant platform serving as the unified data layer for the AgentiQ ecosystem. It provides backend infrastructure for multiple AI agents (Nakamoto, Kn0w1, Moneypenny, AgentIQ-Z) with secure data isolation, role-based access control, and intelligent menu navigation.

## Core Architecture

### Multi-Tenancy System
- **Tenant Isolation**: Every user gets an auto-provisioned personal tenant upon signup
- **Role-Based Access Control (RBAC)**: Separate `roles` and `user_roles` tables with tenant-level permissions
- **Sites**: Multi-site support under each tenant for organizational hierarchy
- **Security**: RLS policies enforce tenant boundaries using helper functions:
  - `user_belongs_to_tenant(user_id, tenant_id)` - Validates tenant membership
  - `is_tenant_admin(user_id, tenant_id)` - Checks admin privileges
  - `get_user_tenant(user_id)` - Retrieves user's primary tenant

### Database Schema
```sql
-- Core tables with RLS enabled:
- tenants (id, name, created_at)
- sites (id, tenant_id, name, created_at)
- roles (id, tenant_id, name, created_at)
- user_roles (id, user_id, role_id, assigned_at)

-- Auto-provisioning trigger:
- on_auth_user_created → handle_new_user()
  Creates tenant + admin role + assigns user
```

## Design System

### Color Palette (HSL-based)
**Light Mode**:
- Background: `hsl(0 0% 100%)`
- Foreground: `hsl(222.2 84% 4.9%)`
- Primary: `hsl(221.2 83.2% 53.3%)` - Vibrant blue for CTAs
- Muted: `hsl(210 40% 96.1%)` - Subtle backgrounds
- Accent: `hsl(210 40% 96.1%)` - Highlight elements
- Border: `hsl(214.3 31.8% 91.4%)` - Soft dividers

**Dark Mode**:
- Background: `hsl(222.2 84% 4.9%)` - Deep navy
- Foreground: `hsl(210 40% 98%)` - Near white
- Primary: `hsl(217.2 91.2% 59.8%)` - Brighter blue
- Muted: `hsl(217.2 32.6% 17.5%)` - Elevated surfaces
- Accent: `hsl(217.2 32.6% 17.5%)` - Subtle highlights
- Border: `hsl(217.2 32.6% 17.5%)` - Muted dividers

### Theme Configuration
- **Modes**: Light/Dark with system preference detection
- **Translucency**: Three levels (off/low/high) for glassmorphic effects
- **Icon Packs**: Customizable icon system (default: Lucide React)
- **Typography**: Clean, sans-serif with proper hierarchy

## Key Features

### 1. Authentication System
- **Email/Password** auth with auto-confirmed signups (non-production default)
- **Tenant Provisioning**: Automatic on signup via `handle_new_user()` trigger
- **Protected Routes**: `ProtectedRoute` component for auth-gated pages
- **Session Management**: Supabase Auth integration

### 2. AgentIQ Smart Menu System
Multi-agent navigation shell with contextual UI adaptation.

**Components**:
- `SmartMenuShell` - Main layout container
- `AgentSwitcher` - Switch between AI agents (Nakamoto/Kn0w1/etc.)
- `PersonaSwitcher` - Manage user personas with identifiability levels
- `IQuBePanel` - Discover and activate IQuBes (modular capabilities)
- `Breadcrumbs` - Hierarchical navigation trail
- `ProfilePane` - User profile management (optional)
- `WalletDock` - Crypto wallet integration (optional)

**State Management** (Jotai + XState):
- `useAgentContext()` - Active agent, origin tracking, agent switching
- `usePersona()` - Persona management with identifiability guards (anon/pseudo/semi/full)
- `useIQuBeFilters()` - Filter IQuBes by tags/capabilities
- `useTheme()` - Theme mode and translucency control
- `smartMenuMachine` - XState state machine for menu orchestration

**Smart Menu Manifest**:
```typescript
{
  version: string,
  tenantId: string,
  appId: string,
  theme: { mode, translucency, iconPack },
  entry: string, // Entry route
  nodes: MenuNode[], // Hierarchical menu
  agents: {
    active: AgentKey,
    origin?: AgentKey,
    allowed: AgentKey[]
  },
  persona: {
    defaultPersonaId?: string,
    identifiability: { min, warnOnIncrease, doubleConfirm },
    historyScope: { includeAgents, excludeAgents, aggregateAcrossAgents }
  },
  iqube: {
    discoverable: FilterExpression,
    operable: FilterExpression,
    activatable: FilterExpression
  },
  roles: { admin: { allowedNodes }, ... },
  features: { profile, payments, wallet, crm }
}
```

### 3. Dashboard Analytics
- **Tenant Stats**: Count of tenants, sites, roles, users
- **Payload Metrics**: Data payloads, shares, meters
- **Visualizations**: 
  - Bar chart: Sites per tenant
  - Pie chart: Roles distribution by tenant
- **Real-time Updates**: React Query integration

### 4. Nakamoto Import System
Bulk data import for Nakamoto agent with JSON validation.

**Import Format**:
```json
{
  "tenantId": "uuid",
  "tenantName": "string",
  "sites": [
    {
      "siteId": "uuid",
      "siteName": "string",
      "roles": [
        {
          "roleId": "uuid",
          "roleName": "string",
          "users": [
            { "userId": "uuid", "email": "string" }
          ]
        }
      ]
    }
  ]
}
```

**Features**:
- File upload or direct JSON paste
- Schema validation
- Edge function processing (`nakamoto_import`)
- Detailed import results (created/updated/errors)

### 5. SDK Packages
Three installable NPM packages under `@qriptoagentiq/*`:

**@qriptoagentiq/core-client**:
```typescript
const core = initAgentiqClient({ url, anonKey });
await core.ensureIamUser();
await core.uploadIntake({ ctx, instanceId, file, envelope });
await core.signedUrl({ payloadId, isoCountry });
await core.sharePayload({ payloadId, subjectType, subjectId, envelope });
```

**@qriptoagentiq/kn0w1-client**:
```typescript
const kn0w1 = new Kn0w1Client(core, { tenantId, siteId });
const feed = await kn0w1.feed(20);
await kn0w1.uploadSensitivePost({ instanceId, file, envelope });
const url = await kn0w1.getSignedUrl(payloadId, 'US');
```

**@qriptoagentiq/a2a-client**:
Agent-to-agent communication protocol (structure exists, implementation deferred to Phase 2).

### 6. Edge Functions
Serverless backend logic (currently in this project, will be migrated):

- `registry_webhook` - Sync external registry data
- `upload_intake` - Handle file uploads with envelope encryption
- `issue_signed_url` - Generate geo-fenced signed URLs
- `generate_derivatives` - Media processing pipeline
- `ipfs_icp_connector` - Decentralized storage integration
- `analytics_refresh` - Refresh materialized views
- `nakamoto_import` - Bulk data import processor
- `naka-reit-kb-ingest` - Knowledge base ingestion

## Application Pages

### `/` (Index)
- Welcome screen with "View Dashboard" CTA
- Minimal, centered layout
- Quick entry point to main functionality

### `/auth` (Authentication)
- Tabbed interface: Sign In / Sign Up
- Email + password fields with validation
- Toast notifications for success/error states
- Auto-redirect to dashboard on successful auth

### `/dashboard` (Analytics Dashboard)
- Protected route (requires auth)
- Summary cards:
  - Total Tenants, Sites, Roles, Users
  - Payloads, Shares, Meters, Contacts
- Interactive charts (Recharts):
  - Sites by Tenant (Bar Chart)
  - Roles by Tenant (Pie Chart)
- "Import Nakamoto Data" button
- React Query for data fetching

### `/nakamoto-import` (Data Import)
- Protected route
- JSON file upload or paste interface
- Optional tenant ID override
- Import validation and processing
- Detailed result display (success/error breakdown)
- Format documentation section

## Technology Stack

**Frontend**:
- React 18.3.1 with TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui components
- React Router DOM v6 (routing)
- React Query (data fetching)
- Jotai (atomic state management)
- XState (state machines)
- Recharts (data visualization)
- Lucide React (icons)
- Zod (schema validation)
- React Hook Form (forms)

**Backend** (to be connected externally):
- Supabase (PostgreSQL database)
- Row-Level Security (RLS) policies
- Edge Functions (Deno runtime)
- Supabase Auth
- Supabase Storage (file handling)

**State Management**:
- Jotai atoms for global state
- React Query for server state
- XState for complex workflows

## Security Features

### Database Level
- **RLS Policies**: All tables protected with tenant-scoped policies
- **Security Definer Functions**: Bypass RLS for administrative checks
- **No Direct Tenant Manipulation**: INSERT/DELETE blocked via RLS
- **Cascade Deletes**: Foreign keys with ON DELETE CASCADE
- **Role Immutability**: User roles cannot be updated, only assigned/revoked

### Application Level
- **Protected Routes**: Auth checks before rendering sensitive pages
- **Tenant Context**: All queries filtered by tenant membership
- **Admin Guards**: `is_tenant_admin()` checks for privileged operations
- **Input Validation**: Zod schemas for all user inputs
- **Toast Notifications**: User feedback for security events

### Data Privacy
- **Envelope Encryption**: Sensitive payloads wrapped with DEKs
- **Geo-Fencing**: Signed URLs with country-level restrictions
- **Persona Identifiability**: Four levels (anon/pseudo/semi/full) with guards

## Phase 2 Features (Deferred)
Not implemented in current project but planned:

1. **BlakQube Encryption**: End-to-end encrypted data storage
2. **Billing & Rev-Share**: Usage metering and revenue distribution
3. **Compliance**: GDPR, CCPA, data residency controls
4. **DID/FIO Identity**: Decentralized identity integration
5. **A2A/MCP Protocol**: Agent-to-agent communication
6. **Hybrid Storage**: IPFS + ICP integration for decentralized files
7. **Operations & Analytics**: Advanced observability

## UI/UX Patterns

### Component Structure
- **Atomic Design**: Small, reusable components
- **Compound Components**: SmartMenuShell composition pattern
- **Controlled Components**: Forms with React Hook Form
- **Optimistic Updates**: React Query mutations with rollback

### Loading States
- Spinners for async operations
- Skeleton screens for data placeholders
- Disabled states during processing

### Error Handling
- Toast notifications (Sonner library)
- Error boundaries for component failures
- Graceful degradation

### Responsive Design
- Mobile-first approach
- Breakpoint-aware layouts (sm/md/lg/xl)
- Touch-friendly interactive elements

## Development Workflow

### Local Setup
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### SDK Package Development
```bash
# Build all packages
npm run build:sdk

# Build specific package
npm run build:core    # @qriptoagentiq/core-client
npm run build:kn0w1   # @qriptoagentiq/kn0w1-client
npm run build:a2a     # @qriptoagentiq/a2a-client

# Generate tarballs for distribution
cd releases/
# Tarballs: qriptoagentiq-*.tgz
```

### Testing
- Acceptance tests in `tests/acceptance.http`
- Manual testing against edge functions
- Unit tests for SDK packages (Jest/Vitest)

## Key Differentiators

1. **Multi-Agent Architecture**: Single platform, multiple AI personalities
2. **Tenant-First Design**: Security through data isolation, not permissions
3. **Smart Menu System**: Context-aware navigation that adapts to agent/persona
4. **IQuBe Modularity**: Discoverable, pluggable capabilities
5. **Identifiability Spectrum**: Privacy controls from anonymous to full identity
6. **SDK Distribution**: Installable npm packages for third-party integration

## Migration Notes for New Project

**What to Replicate**:
- All React components, pages, hooks, SDK code
- Design system (index.css, tailwind.config.ts, theme files)
- Database schema and RLS policies
- Edge function logic (manually deploy to external Supabase)

**What NOT to Replicate**:
- Lovable Cloud integration (use external Supabase connection)
- `.env` file (will be generated by new Supabase connection)
- `src/integrations/supabase/` (auto-generated by Supabase)
- `supabase/config.toml` (specific to this backend)

**Critical Connection Step**:
1. Create new Lovable project
2. Connect to external Supabase (bsjhfvctmduxhohtllly) FIRST
3. Run database migrations to replicate schema
4. Copy all frontend code and SDK packages
5. Manually deploy edge functions to external backend
6. Test authentication and tenant provisioning

---

**Project Status**: Production-ready with Phase 2 enhancements planned.
**License**: MIT
**Support**: Documentation + Discord community
