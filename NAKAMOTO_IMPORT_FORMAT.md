# Nakamoto Import Data Format

This document describes the exact JSON format required for importing Nakamoto data via the `nakamoto_import` edge function.

## Top-Level Structure

```json
{
  "tenant_id": "your-tenant-uuid-here",
  "data": {
    "users": [...],
    "interactions": [...],
    "knowledge_base": [...],
    "prompts": [...]
  }
}
```

## User Migration Records

Each user record in the `users` array must have this structure:

```json
{
  "source_user_id": "original-nakamoto-user-uuid",
  "email": "user@example.com",
  "tenant_id": "target-tenant-uuid",
  "status": "completed",  // or "invited" or "expired"
  "persona_type": "knyt",  // or "qripto"
  
  "invitation_status": {
    "invited_at": "2024-01-15T10:30:00Z",
    "invited_by": "inviter@example.com",  // nullable
    "batch_id": "batch-123",  // nullable
    "email_sent": true,
    "email_sent_at": "2024-01-15T10:30:00Z",  // nullable
    "send_attempts": 1,
    "expires_at": "2024-02-15T10:30:00Z",
    "signup_completed": true,
    "completed_at": "2024-01-16T14:20:00Z",  // nullable
    "invitation_token": "unique-token-string"
  },
  
  "persona_data": {
    "First-Name": "John",
    "Last-Name": "Doe",
    "KNYT-ID": "knyt-123",
    "Profession": "Developer",
    "Local-City": "San Francisco",
    "Email": "user@example.com",
    "Phone-Number": "+1234567890",
    "Age": "30",
    "Address": "123 Main St",
    "EVM-Public-Key": "0x...",
    "BTC-Public-Key": "bc1...",
    "ThirdWeb-Public-Key": "0x...",
    "MetaKeep-Public-Key": "0x...",
    "Chain-IDs": ["ethereum", "polygon"],
    "Web3-Interests": ["DeFi", "NFTs"],
    "Tokens-of-Interest": ["ETH", "MATIC"],
    "Wallets-of-Interest": ["metamask", "coinbase"],
    "LinkedIn-ID": "linkedin-id",
    "LinkedIn-Profile-URL": "https://linkedin.com/in/...",
    "Twitter-Handle": "@johndoe",
    "Telegram-Handle": "@johndoe",
    "Discord-Handle": "johndoe#1234",
    "Instagram-Handle": "@johndoe",
    "YouTube-ID": "youtube-id",
    "Facebook-ID": "facebook-id",
    "TikTok-Handle": "@johndoe",
    "OM-Member-Since": "2023-01-01",
    "OM-Tier-Status": "gold",
    "Metaiye-Shares-Owned": "100",
    "Total-Invested": "5000",
    "KNYT-COYN-Owned": "1000",
    "Motion-Comics-Owned": "5",
    "Paper-Comics-Owned": "10",
    "Digital-Comics-Owned": "20",
    "KNYT-Posters-Owned": "3",
    "KNYT-Cards-Owned": "50",
    "Characters-Owned": "15",
    "profile_image_url": "https://..."
  },
  
  "connection_data": [
    {
      "service": "linkedin",
      "connected_at": "2024-01-15T10:30:00Z",
      "connection_data": {
        "access_token": "encrypted-token",
        "profile_id": "linkedin-profile-id"
      }
    },
    {
      "service": "metamask",
      "connected_at": "2024-01-16T11:00:00Z",
      "connection_data": {
        "wallet_address": "0x..."
      }
    }
  ],
  
  "name_preferences": {
    "persona_type": "knyt",
    "name_source": "invitation",  // or "linkedin" or "custom"
    "invitation_first_name": "John",
    "invitation_last_name": "Doe",
    "linkedin_first_name": null,
    "linkedin_last_name": null,
    "custom_first_name": null,
    "custom_last_name": null
  },
  
  "profile": {
    "first_name": "John",
    "last_name": "Doe",
    "avatar_url": "https://...",
    "total_points": 1500,
    "level": 5
  },
  
  "auth_user_id": "new-qubebase-auth-user-uuid",  // nullable
  "auth_created_at": "2024-01-15T10:30:00Z",  // nullable
  
  "meta": {
    "migration_notes": "Migrated from Nakamoto v1",
    "original_created_at": "2023-01-01T00:00:00Z"
  }
}
```

### Required Fields for Users
- `source_user_id` (string, UUID)
- `email` (string, valid email)
- `tenant_id` (string, UUID)
- `status` (enum: "completed", "invited", or "expired")
- `persona_type` (enum: "knyt" or "qripto")
- `invitation_status` (object with all required subfields)
- `persona_data` (object, can be empty but must exist)

### Optional Fields for Users
- `connection_data` (array, defaults to [])
- `name_preferences` (object, nullable)
- `profile` (object, nullable)
- `auth_user_id` (string UUID, nullable)
- `auth_created_at` (string datetime, nullable)
- `meta` (object, defaults to {})

## Interaction History Records

Each interaction in the `interactions` array:

```json
{
  "source_user_id": "original-nakamoto-user-uuid",
  "query": "What is KNYT Comics?",
  "response": "KNYT Comics is...",
  "interaction_type": "aigent",  // or "connect", "earn", "learn"
  "metadata": {
    "session_id": "session-123",
    "device": "mobile"
  },
  "summarized": false,
  "created_at": "2024-01-15T10:30:00Z",
  "persona_type": "knyt"  // optional: "knyt" or "qripto"
}
```

### Required Fields for Interactions
- `source_user_id` (string, must match a user in the users array)
- `query` (string)
- `response` (string)
- `interaction_type` (string)
- `summarized` (boolean)
- `created_at` (string, ISO 8601 datetime)

### Optional Fields for Interactions
- `metadata` (any, defaults to {})
- `persona_type` (enum: "knyt" or "qripto")

## Knowledge Base Documents

Each KB document in the `knowledge_base` array:

```json
{
  "title": "KNYT Comics Overview",
  "content_text": "# KNYT Comics\n\nKNYT Comics is...",
  "source_uri": "https://knytcomics.com/overview",
  "lang": "en",
  "tags": ["knyt", "comics", "web3"],
  "metadata": {
    "author": "KNYT Team",
    "last_updated": "2024-01-15"
  }
}
```

### Required Fields for KB Docs
- `title` (string, unique within corpus)

### Optional Fields for KB Docs
- `content_text` (string, defaults to "")
- `source_uri` (string)
- `lang` (string, defaults to "en")
- `tags` (array of strings, defaults to [])
- `metadata` (any, defaults to {})

## System Prompts

Each prompt in the `prompts` array:

```json
{
  "prompt_key": "nakamoto_system_prompt",
  "prompt_text": "You are the Nakamoto AI assistant...",
  "metadata": {
    "version": "1.0",
    "last_updated": "2024-01-15"
  }
}
```

### Required Fields for Prompts
- `prompt_key` (string, unique identifier)
- `prompt_text` (string, the actual prompt)

### Optional Fields for Prompts
- `metadata` (any, defaults to {})

## Complete Example

Here's a minimal complete example with all data types:

```json
{
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "data": {
    "users": [
      {
        "source_user_id": "11111111-1111-1111-1111-111111111111",
        "email": "user@example.com",
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "status": "completed",
        "persona_type": "knyt",
        "invitation_status": {
          "invited_at": "2024-01-15T10:30:00Z",
          "invited_by": null,
          "batch_id": null,
          "email_sent": true,
          "email_sent_at": "2024-01-15T10:30:00Z",
          "send_attempts": 1,
          "expires_at": "2024-02-15T10:30:00Z",
          "signup_completed": true,
          "completed_at": "2024-01-16T14:20:00Z",
          "invitation_token": "unique-token-abc123"
        },
        "persona_data": {
          "First-Name": "John",
          "Last-Name": "Doe",
          "Email": "user@example.com"
        },
        "connection_data": [],
        "name_preferences": null,
        "profile": {
          "first_name": "John",
          "last_name": "Doe",
          "avatar_url": null,
          "total_points": 0,
          "level": 1
        },
        "auth_user_id": "22222222-2222-2222-2222-222222222222",
        "auth_created_at": "2024-01-16T14:20:00Z",
        "meta": {}
      }
    ],
    "interactions": [
      {
        "source_user_id": "11111111-1111-1111-1111-111111111111",
        "query": "What is KNYT?",
        "response": "KNYT is a comic book series...",
        "interaction_type": "aigent",
        "metadata": {},
        "summarized": false,
        "created_at": "2024-01-17T10:00:00Z",
        "persona_type": "knyt"
      }
    ],
    "knowledge_base": [
      {
        "title": "KNYT Overview",
        "content_text": "KNYT Comics is...",
        "tags": ["knyt", "comics"]
      }
    ],
    "prompts": [
      {
        "prompt_key": "nakamoto_system",
        "prompt_text": "You are the Nakamoto assistant..."
      }
    ]
  }
}
```

## Important Notes

1. **Tenant ID**: Must be specified at the top level OR will auto-detect from the authenticated user
2. **User ID Mapping**: The function automatically maps `source_user_id` to `new_user_id` for interaction imports
3. **Timestamps**: All timestamps must be in ISO 8601 format (e.g., "2024-01-15T10:30:00Z")
4. **UUIDs**: All ID fields must be valid UUIDs
5. **Persona Type**: Must be exactly "knyt" or "qripto" (lowercase)
6. **Deduplication**: 
   - Users are deduplicated by `source_user_id`
   - KB docs are deduplicated by `corpus_id + title`
   - Prompts are deduplicated by `app + tenant_id + prompt_key + scope`

## Validation

All data is validated using Zod schemas before import. If validation fails, you'll receive a 400 error with details about which fields are invalid.
