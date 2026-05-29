// TODO(Section F): rewrite for post-deconvergence shape. Currently quarantined.
// References deleted symbols: SAAS_SHARED_PROFILE, SAAS_SILO_PROFILE,
// SaasTopology, profile.saasTopology field. Section F will rewrite this
// suite against the new shape (single SAAS_PROFILE, no topology field).
import { describe, it, expect } from 'vitest';
// import {
//     getDeploymentProfile,
//     STANDALONE_PROFILE,
//     SAAS_SHARED_PROFILE,
//     SAAS_SILO_PROFILE,
// } from '../../src/lib/deployment-profile';

const FALLBACK_TENANT = '00000000-0000-0000-0000-000000000000';

describe.skip('deployment profile constants', () => {
    it('STANDALONE_PROFILE has expected capabilities', () => {
        // TODO(Section F): rewrite for post-deconvergence shape
        expect(FALLBACK_TENANT).toBeDefined();
    });

    it('SAAS_SHARED_PROFILE marks billing + seat quota', () => {
        // TODO(Section F): rewrite for post-deconvergence shape
    });

    it('SAAS_SILO_PROFILE drops seat quota, requires DNS provisioning', () => {
        // TODO(Section F): rewrite for post-deconvergence shape
    });
});

describe.skip('getDeploymentProfile factory', () => {
    it('returns SAAS_SHARED_PROFILE when APP_MODE=saas (default topology)', () => {
        // TODO(Section F): rewrite for post-deconvergence shape
    });

    it('returns SAAS_SILO_PROFILE when APP_MODE=saas + SAAS_TOPOLOGY=silo', () => {
        // TODO(Section F): rewrite for post-deconvergence shape
    });

    it('returns STANDALONE_PROFILE by default with FALLBACK tenant id', () => {
        // TODO(Section F): rewrite for post-deconvergence shape
    });

    it('honors env.SINGLE_TENANT_ID override on standalone', () => {
        // TODO(Section F): rewrite for post-deconvergence shape
    });
});
