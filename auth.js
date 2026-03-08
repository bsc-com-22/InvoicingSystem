/**
 * auth.js
 * Handles Supabase Authentication: sign up, login, logout, session guard.
 */

import { supabaseClient } from './supabaseClient.js';
import { getUserSettings } from './invoices.js';

/* ─── Session Guard ──────────────────────────────────────────────────────────
   Call on protected pages. Redirects to index.html if no active session.     */
export async function requireAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }

    try {
        const settings = await getUserSettings();
        if (settings) {
            if (settings.company_name !== null) localStorage.setItem('invoiceflow_company_name', settings.company_name);
            if (settings.company_email !== null) localStorage.setItem('invoiceflow_company_email', settings.company_email);
            if (settings.company_phone !== null) localStorage.setItem('invoiceflow_company_phone', settings.company_phone);
            if (settings.company_address !== null) localStorage.setItem('invoiceflow_company_address', settings.company_address);
            if (settings.company_tax !== null) localStorage.setItem('invoiceflow_company_tax', settings.company_tax);
            if (settings.company_website !== null) localStorage.setItem('invoiceflow_company_website', settings.company_website);
            if (settings.payment_terms !== null) localStorage.setItem('invoiceflow_payment_terms', settings.payment_terms);

            if (settings.logo_url) {
                localStorage.setItem('invoiceflow_logo', settings.logo_url);
                localStorage.setItem('invoiceflow_logo_w', settings.logo_w || 0);
                localStorage.setItem('invoiceflow_logo_h', settings.logo_h || 0);
                localStorage.setItem('invoiceflow_logo_file', settings.logo_file || 'logo');
            } else {
                localStorage.removeItem('invoiceflow_logo');
                localStorage.removeItem('invoiceflow_logo_w');
                localStorage.removeItem('invoiceflow_logo_h');
                localStorage.removeItem('invoiceflow_logo_file');
            }

            if (settings.payment_methods) {
                localStorage.setItem('invoiceflow_pm_state', JSON.stringify(settings.payment_methods));
            }
        }
    } catch (e) {
        console.error('Failed to sync settings from db:', e);
    }

    return session;
}

/* ─── Get Current User ───────────────────────────────────────────────────── */
export async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}



/* ─── Login ──────────────────────────────────────────────────────────────── */
export async function login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

/* ─── Update Password ──────────────────────────────────────────────────────── */
export async function updatePassword(newPassword) {
    const { data, error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
}

/* ─── Logout ─────────────────────────────────────────────────────────────── */
export async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    window.location.href = 'index.html';
}

/* ─── Auth State Listener ────────────────────────────────────────────────── */
export function onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}
