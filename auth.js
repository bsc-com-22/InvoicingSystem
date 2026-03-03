/**
 * auth.js
 * Handles Supabase Authentication: sign up, login, logout, session guard.
 */

import { supabaseClient } from './supabaseClient.js';

/* ─── Session Guard ──────────────────────────────────────────────────────────
   Call on protected pages. Redirects to index.html if no active session.     */
export async function requireAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }
    return session;
}

/* ─── Get Current User ───────────────────────────────────────────────────── */
export async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

/* ─── Sign Up ────────────────────────────────────────────────────────────── */
export async function signUp(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

/* ─── Login ──────────────────────────────────────────────────────────────── */
export async function login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
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
