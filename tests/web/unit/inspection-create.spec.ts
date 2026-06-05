import { describe, it, expect } from "vitest";
import { buildCreateInspectionJson } from "~/lib/inspection-create";

/**
 * B-8 fix — the New Inspection wizard posts { intent:"create", address,
 * templateId, date, time, inspectorId, ... } to the /dashboard action. The
 * action was missing a "create" branch (silent no-op). This helper maps the
 * wizard fields to the CreateInspectionSchema JSON the POST /api/inspections
 * endpoint expects (notably combining the date + time fields into one ISO).
 */
function fd(entries: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
}

describe("buildCreateInspectionJson", () => {
    it("maps address→propertyAddress, templateId, and combines date+time into ISO", () => {
        const json = buildCreateInspectionJson(fd({
            address: "100 Smoke Test Lane, Austin, TX",
            templateId: "625fb306-bde0-4fe9-a0e8-d8151296b23a",
            date: "2026-06-02",
            time: "09:00",
        }));
        expect(json.propertyAddress).toBe("100 Smoke Test Lane, Austin, TX");
        expect(json.templateId).toBe("625fb306-bde0-4fe9-a0e8-d8151296b23a");
        expect(json.date).toBe("2026-06-02T09:00:00Z");
    });

    it("omits date when no date is provided", () => {
        const json = buildCreateInspectionJson(fd({ address: "1 A St", templateId: "t" }));
        expect("date" in json).toBe(false);
    });

    it("includes inspectorId only when it is a valid UUID", () => {
        // empty → omitted
        expect("inspectorId" in buildCreateInspectionJson(fd({ address: "1 A St", templateId: "t", inspectorId: "" }))).toBe(false);
        // non-UUID free text (e.g. a typed name/id) → dropped, since the schema
        // types inspectorId as z.string().uuid() — sending it would 400 the create.
        expect("inspectorId" in buildCreateInspectionJson(fd({ address: "1 A St", templateId: "t", inspectorId: "u9" }))).toBe(false);
        // valid UUID → forwarded
        const uuid = "625fb306-bde0-4fe9-a0e8-d8151296b23a";
        expect(buildCreateInspectionJson(fd({ address: "1 A St", templateId: "t", inspectorId: uuid })).inspectorId).toBe(uuid);
    });

    it("defaults the time to 09:00 when only a date is given", () => {
        const json = buildCreateInspectionJson(fd({ address: "1 A St", templateId: "t", date: "2026-06-02" }));
        expect(json.date).toBe("2026-06-02T09:00:00Z");
    });

    // IA-1 People step tests
    it("maps clientName/clientEmail/clientPhone into client object", () => {
        const json = buildCreateInspectionJson(fd({
            address: "1 A St", templateId: "t",
            clientName: "Jane Buyer",
            clientEmail: "jane@example.com",
            clientPhone: "(555) 999-0000",
        }));
        expect(json.client).toEqual({ name: "Jane Buyer", email: "jane@example.com", phone: "(555) 999-0000" });
    });

    it("omits client entirely when clientName is empty", () => {
        // Leaving the People step completely empty is a legal skip.
        const json = buildCreateInspectionJson(fd({
            address: "1 A St", templateId: "t",
            clientName: "", clientEmail: "", clientPhone: "",
        }));
        expect("client" in json).toBe(false);
    });

    it("omits optional client fields when email and phone are empty", () => {
        const json = buildCreateInspectionJson(fd({
            address: "1 A St", templateId: "t",
            clientName: "John Smith",
        }));
        expect(json.client).toEqual({ name: "John Smith" });
        expect("email" in (json.client ?? {})).toBe(false);
        expect("phone" in (json.client ?? {})).toBe(false);
    });

    it("passes agentContactId when it is a valid UUID", () => {
        const agentId = "aabbccdd-0000-1111-2222-333344445555";
        const json = buildCreateInspectionJson(fd({
            address: "1 A St", templateId: "t",
            agentContactId: agentId,
        }));
        expect(json.agentContactId).toBe(agentId);
        expect("newAgent" in json).toBe(false);
    });

    it("maps newAgentName/newAgentEmail into newAgent when no agentContactId", () => {
        const json = buildCreateInspectionJson(fd({
            address: "1 A St", templateId: "t",
            newAgentName: "Bob Realtor",
            newAgentEmail: "bob@realty.com",
        }));
        expect(json.newAgent).toEqual({ name: "Bob Realtor", email: "bob@realty.com" });
        expect("agentContactId" in json).toBe(false);
    });

    it("agentContactId wins over newAgent when both are present", () => {
        const agentId = "aabbccdd-0000-1111-2222-333344445555";
        const json = buildCreateInspectionJson(fd({
            address: "1 A St", templateId: "t",
            agentContactId: agentId,
            newAgentName: "Bob Realtor",
            newAgentEmail: "bob@realty.com",
        }));
        expect(json.agentContactId).toBe(agentId);
        expect("newAgent" in json).toBe(false);
    });
});
