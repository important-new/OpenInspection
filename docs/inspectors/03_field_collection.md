# Field Data Collection

The field form at `/inspections/:id/form` is the mobile-first UI inspectors use on-site. It works offline and syncs automatically when connectivity is restored.

---

## Opening the Field Form

From the dashboard, click **Open Form** on any inspection. On a phone or tablet, bookmark the URL or add it to your home screen for quick access.

The form URL pattern is:
```
https://your-domain.com/inspections/INSPECTION_ID/form
```

You need to be logged in (have a valid `inspector_token` cookie) to save data. If you open the form without being logged in, you can still fill it out — data is saved locally — but the sync to the server will fail until you log in.

---

## Using the Form

The form renders all sections and items from the inspection's template. For each checklist item you see:

### Status
A three-option selector:
- **OK** — No issues found
- **Monitor** — Requires watching; not currently a defect
- **Defect** — Actionable issue that needs repair or further evaluation

### Notes
A free-text field for your observations. Tap the **AI Assist** button (✨) to generate a suggested comment based on the item label and selected status. The suggestion appears in the notes field and can be edited before saving.

> AI Assist requires a `GEMINI_API_KEY` to be configured. If the key is missing, the button is hidden.

### Photos
Tap **Add Photo** to open the device camera or photo library. Photos are uploaded immediately to R2 storage and the key is stored in the item's field data. Multiple photos per item are supported.

After a photo uploads, a thumbnail appears below the item. Tap the thumbnail to view full size (served via the proxy endpoint `/api/inspections/files/:key`).

---

## Offline Mode

The field form stores all entered data in the browser's **IndexedDB** as you type. If you lose connectivity:

- All data continues to save locally
- A "Offline" indicator appears at the top of the form
- Photos queue for upload and retry when connectivity returns

When connectivity is restored, the form automatically syncs all pending changes to the server using `PATCH /api/inspections/:id/results`.

**Best practice:** Tap **Save & Sync** manually at the end of each section to confirm data has reached the server, especially in areas with intermittent signal.

---

## Photo Annotations

After uploading a photo, tap **Annotate** to open the canvas annotation tool. You can:

- Draw arrows and circles to highlight specific areas
- Add text labels
- Save the annotated version as a new photo (the original is preserved)

Annotated photos appear alongside the originals in the report.

---

## Completing Data Collection

When all items are filled in:

1. Review the form — items with no status selected are shown with an amber indicator.
2. Tap **Finish & Return to Dashboard**.
3. From the dashboard, click **Mark Complete** to finalize the inspection and notify the client.

> The form does not automatically mark the inspection complete — this is a deliberate step on the dashboard so you can review the data first.

---

## Saving Partial Work

You can close the form and return later. Local data is preserved in IndexedDB indefinitely. Data synced to the server is durable in D1.

To resume: open the same form URL (`/inspections/:id/form`). The form loads the latest server data and merges it with any unsynced local changes.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Photos fail to upload | Network error or R2 misconfigured | Check your R2 bucket binding in `wrangler.toml` |
| AI Assist button missing | `GEMINI_API_KEY` not set | Add the key via `wrangler secret put GEMINI_API_KEY` |
| Sync fails with 401 | JWT expired | Log in again from `/dashboard` |
| Form shows wrong checklist | Wrong `templateId` on the inspection | Edit the inspection record in D1 |
