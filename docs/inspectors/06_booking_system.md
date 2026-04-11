# Booking System

The public booking page at `/book` lets clients schedule an inspection themselves. This page is part of your branded website — clients select an inspector, pick a date, choose a time slot, and submit their details.

---

## How Booking Works

1. Client visits `/book` on your domain.
2. They select an inspector from the dropdown.
3. They pick a date — available slots for that day are fetched from `/api/public/availability/:inspectorId?date=YYYY-MM-DD`.
4. They select a time slot.
5. They fill in the property address, name, and email.
6. On submit, a `POST /api/public/book` request creates an inspection with `status: 'draft'`.
7. The new inspection appears in your dashboard immediately.

No login is required from the client. The booking page is fully public.

---

## Setting Up Inspector Availability

Before clients can book, each inspector needs their weekly availability configured. Without any availability records, no slots are returned and clients see an empty calendar.

**Option A — via the Availability API (recommended):**

```bash
curl -X PUT https://your-domain.com/api/availability \
  -H "Authorization: Bearer YOUR_INSPECTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      { "dayOfWeek": 1, "startTime": "08:00", "endTime": "17:00" },
      { "dayOfWeek": 2, "startTime": "08:00", "endTime": "17:00" },
      { "dayOfWeek": 3, "startTime": "08:00", "endTime": "17:00" },
      { "dayOfWeek": 4, "startTime": "08:00", "endTime": "17:00" },
      { "dayOfWeek": 5, "startTime": "08:00", "endTime": "17:00" }
    ]
  }'
```

`PUT /api/availability` is a full replace — send the complete desired schedule each time.

**Option B — via D1 directly:**

```sql
-- Example: John is available Mon–Fri, 8am–5pm
INSERT INTO availability (id, tenant_id, inspector_id, day_of_week, start_time, end_time, created_at)
VALUES
    ('av-mon', 'your-tenant-id', 'inspector-user-id', 1, '08:00', '17:00', unixepoch()),
    ('av-tue', 'your-tenant-id', 'inspector-user-id', 2, '08:00', '17:00', unixepoch()),
    ('av-wed', 'your-tenant-id', 'inspector-user-id', 3, '08:00', '17:00', unixepoch()),
    ('av-thu', 'your-tenant-id', 'inspector-user-id', 4, '08:00', '17:00', unixepoch()),
    ('av-fri', 'your-tenant-id', 'inspector-user-id', 5, '08:00', '17:00', unixepoch());
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
```

The booking system splits availability windows into 1-hour slots automatically. An 08:00–17:00 window produces slots at 08:00, 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, and 16:00.

Slots already booked (existing inspections on that date) are removed from the available list to prevent double-booking.

---

## Google Calendar Sync

If `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured, inspectors can connect their Google Calendar to automatically block out busy days.

### Connecting Google Calendar

1. As an inspector, visit `/api/calendar/connect` — you'll be redirected to Google's OAuth consent screen.
2. Grant calendar access. You'll be redirected back to `/dashboard?calendar=connected`.
3. Your Google Calendar is now linked.

### Syncing Availability

Once connected, call `POST /api/calendar/sync` to pull the next 30 days of Google Calendar events and create `availabilityOverrides` for any busy blocks:

```bash
curl -X POST https://your-domain.com/api/calendar/sync \
  -H "Cookie: inspector_token=YOUR_TOKEN"
```

Re-run this periodically to keep availability in sync. Existing overrides for the same date are not duplicated.

### Automatic Calendar Events

When a client books an inspection and the assigned inspector has Google Calendar connected, the booking is automatically added to their Google Calendar (non-blocking, runs in the background via `waitUntil`).

### Disconnecting

```bash
curl -X DELETE https://your-domain.com/api/calendar/disconnect \
  -H "Cookie: inspector_token=YOUR_TOKEN"
```

---

## Availability Overrides

To block out specific dates (vacation, holidays) or add custom hours for a single day, use the Overrides API:

**Via the Overrides API:**

```bash
# Block an entire day (vacation)
curl -X POST https://your-domain.com/api/availability/overrides \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-07-04", "isAvailable": false}'

# Custom hours for a single day
curl -X POST https://your-domain.com/api/availability/overrides \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-12-24", "isAvailable": true, "startTime": "09:00", "endTime": "13:00"}'
```

To remove an override: `DELETE /api/availability/overrides/:id`

An override for a date always takes precedence over the recurring weekly schedule.

---

## Default Booking Price

Bookings submitted via the public booking page default to **$450.00** (`price: 45000` in cents). To change the default, edit `src/api/bookings.ts`:

```ts
price: 45000  // → change to your standard rate
```

You can also pass a `price` field in the booking request body to override it per booking.

---

## Booking Confirmation Email

When a client submits a booking, a confirmation email is automatically sent to their email address via Resend (if `RESEND_API_KEY` is configured). The email includes:

- Property address
- Date and time of the inspection
- Reference ID

This runs non-blocking in the background and does not delay the booking response.

---

## Reviewing New Bookings

All bookings appear in the dashboard with `status: 'draft'` immediately after submission. Review and confirm each booking by opening it and assigning the correct inspector if needed.

---

## Agent Referral CRM

The Agent CRM tracks which real estate agent referred each inspection, enabling you to measure and reward your referral relationships.

### How referrals are tracked

Set `referredByAgentId` to the agent's user ID when creating an inspection:

**Via the dashboard:** Fill in the "Referred By" field when creating an inspection.

**Via API:**
```json
POST /api/inspections
{
  "propertyAddress": "789 Pine St",
  "templateId": "template-id",
  "referredByAgentId": "agent-user-id"
}
```

**Via public booking:** The booking page can pass a `?agent=<agentId>` URL parameter (add this to the Booking page template to support agent-specific booking links).

### Agent Dashboard

Agents log in and visit `/agent-dashboard` to see all inspections they referred. The dashboard shows:

- Property address and client name
- Inspection status (with color-coded badges)
- Inspection date
- Total referral count summary

Agents only see their own referrals. Admins and owners see all referrals.

### Referral Leaderboard

Admins and owners can call the leaderboard API to see which agents are sending the most referrals:

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     https://your-domain.com/api/agent/leaderboard
```

Response:
```json
{
  "leaderboard": [
    { "agentId": "agent-user-id", "total": 14 },
    { "agentId": "another-agent-id", "total": 9 }
  ]
}
```

### Setting Up Agent Accounts

1. Create a user account with `role: 'agent'` (see [Team Management](./05_team_management.md)).
2. Share the `/agent-dashboard` URL with the agent.
3. The agent logs in with their email and password — they see only their referred inspections.

### Agent-Specific Booking Links

To give each agent a unique booking link pre-filled with their ID, add query param support to the booking page template. The URL pattern:

```
https://your-domain.com/book?agent=AGENT_USER_ID
```

The booking template can read this parameter and include the `referredByAgentId` in the booking submission automatically.
