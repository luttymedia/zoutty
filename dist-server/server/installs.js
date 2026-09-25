import { getSupabaseAdmin } from './referrals.js';
/**
 * Records a new device installation event in Supabase.
 * Fails gracefully if the database table is not yet migrated.
 */
export async function recordDeviceInstall(data, ipAddress, userId) {
    try {
        const supabase = getSupabaseAdmin();
        const insertPayload = {
            user_id: userId || null,
            device_platform: data.devicePlatform || 'Unknown',
            device_type: data.deviceType || 'desktop',
            browser: data.browser || 'Unknown',
            browser_version: data.browserVersion || null,
            os_version: data.osVersion || null,
            user_agent: (data.userAgent || '').slice(0, 500),
            screen_resolution: data.screenResolution || null,
            screen_density: typeof data.screenDensity === 'number' ? data.screenDensity : null,
            install_source: data.installSource || 'pwa_prompt',
            language: data.language || null,
            timezone: data.timezone || null,
            ip_address: ipAddress || null,
            raw_details: data.rawDetails || {},
        };
        console.log(`[installs] Recording install: ${insertPayload.device_platform} (${insertPayload.device_type}) via ${insertPayload.browser} [${insertPayload.install_source}]`);
        const { data: record, error } = await supabase
            .from('install_tracking')
            .insert(insertPayload)
            .select('id')
            .maybeSingle();
        if (error) {
            if (error.code === '42P01') {
                console.warn('[installs] "install_tracking" table does not exist in Supabase yet. Please execute supabase-install-tracking-schema.sql.');
                return { success: false, error: 'Database table not created yet. Run supabase-install-tracking-schema.sql.' };
            }
            console.error('[installs] Failed to record device install in Supabase:', error);
            return { success: false, error: error.message };
        }
        return { success: true, id: record?.id };
    }
    catch (err) {
        console.error('[installs] Unexpected error while recording install:', err);
        return { success: false, error: err?.message || 'Internal error' };
    }
}
/**
 * Aggregates device installation statistics for reporting and analytics.
 */
export async function getDeviceInstallStats() {
    try {
        const supabase = getSupabaseAdmin();
        const { data: records, error } = await supabase
            .from('install_tracking')
            .select('id, device_platform, device_type, browser, install_source, language, timezone, installed_at, user_id')
            .order('installed_at', { ascending: false })
            .limit(1000);
        if (error) {
            if (error.code === '42P01') {
                return {
                    totalInstalls: 0,
                    byPlatform: {},
                    byDeviceType: {},
                    byBrowser: {},
                    bySource: {},
                    recentInstalls: [],
                    notice: 'Table "install_tracking" not found. Run supabase-install-tracking-schema.sql in Supabase SQL Editor.'
                };
            }
            throw error;
        }
        const allRecords = records || [];
        const byPlatform = {};
        const byDeviceType = {};
        const byBrowser = {};
        const bySource = {};
        for (const r of allRecords) {
            const plat = r.device_platform || 'Unknown';
            byPlatform[plat] = (byPlatform[plat] || 0) + 1;
            const type = r.device_type || 'Unknown';
            byDeviceType[type] = (byDeviceType[type] || 0) + 1;
            const br = r.browser || 'Unknown';
            byBrowser[br] = (byBrowser[br] || 0) + 1;
            const src = r.install_source || 'Unknown';
            bySource[src] = (bySource[src] || 0) + 1;
        }
        return {
            totalInstalls: allRecords.length,
            byPlatform,
            byDeviceType,
            byBrowser,
            bySource,
            recentInstalls: allRecords.slice(0, 25),
        };
    }
    catch (err) {
        console.error('[installs] Failed to fetch device install stats:', err);
        return {
            error: err?.message || 'Failed to fetch install stats',
            totalInstalls: 0,
            byPlatform: {},
            byDeviceType: {},
            byBrowser: {},
            bySource: {},
            recentInstalls: [],
        };
    }
}
