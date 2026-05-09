import { describe, it, expect } from 'vitest';
import { AgentDashboardPage } from '../../src/templates/pages/agent-dashboard';

function render(node: JSX.Element): string {
    return String(node as unknown as { toString(): string });
}

describe('AgentDashboardPage placeholder — A1', () => {
    it('renders the agent name when provided', () => {
        const html = render(AgentDashboardPage({ agentName: 'Jane Smith' }));
        expect(html).toContain('Jane Smith');
    });

    it('falls back gracefully when no agent name is supplied', () => {
        const html = render(AgentDashboardPage());
        expect(html).not.toContain('undefined');
        expect(html.length).toBeGreaterThan(200);
    });

    it('signals "coming soon / next sprint" so users know the real dashboard is in A2', () => {
        const html = render(AgentDashboardPage({ agentName: 'Jane' }));
        // Either "coming" (next sprint copy) or an explicit A2 reference satisfies the
        // placeholder contract — the user must see this is an interim view.
        expect(html.toLowerCase()).toMatch(/coming|next sprint|preview/);
    });

    it('exposes a sign-out affordance so an agent can log out from the placeholder', () => {
        const html = render(AgentDashboardPage({ agentName: 'Jane' }));
        expect(html.toLowerCase()).toMatch(/sign\s*out|logout|log\s*out/);
    });

    it('uses the editorial Fraunces serif headline of the surface/ink/blueprint design tokens', () => {
        const html = render(AgentDashboardPage({ agentName: 'Jane' }));
        expect(html).toContain('Fraunces');
    });
});
