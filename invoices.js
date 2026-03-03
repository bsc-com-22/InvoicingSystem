/**
 * invoices.js
 * All Supabase data operations: clients, invoices, invoice items, stats, storage.
 */

import { supabaseClient } from './supabaseClient.js';

/* ═══════════════════════════════════════════════════════════════════════════
   CLIENT OPERATIONS
═══════════════════════════════════════════════════════════════════════════ */

/** Fetch all clients for the logged-in user, sorted by name */
export async function getClients() {
    const { data, error } = await supabaseClient
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
    if (error) throw error;
    return data;
}

/** Create a new client record */
export async function createClient(clientData) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data, error } = await supabaseClient
        .from('clients')
        .insert([{ ...clientData, user_id: user.id }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

/** Update an existing client */
export async function updateClient(clientId, clientData) {
    const { data, error } = await supabaseClient
        .from('clients')
        .update(clientData)
        .eq('id', clientId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVOICE OPERATIONS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Fetch all invoices for the logged-in user, joined with client name.
 * Supports optional filters: status, dateFrom, dateTo.
 */
export async function getInvoices(filters = {}) {
    let query = supabaseClient
        .from('invoices')
        .select(`
      *,
      clients ( name, email )
    `)
        .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    if (filters.dateFrom) {
        query = query.gte('issue_date', filters.dateFrom);
    }
    if (filters.dateTo) {
        query = query.lte('issue_date', filters.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

/** Fetch a single invoice with its line items and client details */
export async function getInvoiceById(invoiceId) {
    const { data, error } = await supabaseClient
        .from('invoices')
        .select(`
      *,
      clients ( * ),
      invoice_items ( * ),
      payment_methods ( *, payment_accounts ( * ) )
    `)
        .eq('id', invoiceId)
        .single();
    if (error) throw error;
    return data;
}

export async function generateInvoiceNumber() {
    const { data, error } = await supabaseClient
        .from('invoices')
        .select('invoice_number')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
        return 'INV-0001';
    }

    const lastNumStr = data[0].invoice_number;
    const match = lastNumStr.match(/\d+$/);
    if (match) {
        const next = parseInt(match[0], 10) + 1;
        return `INV-${String(next).padStart(4, '0')}`;
    }

    return `INV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

/**
 * Create a new invoice together with its line items.
 * Runs two sequential inserts: invoice header → line items.
 * invoiceData should include: client_id, invoice_number, issue_date, due_date,
 *   subtotal, discount (pct), tax (pct), total.
 */
export async function createInvoice(invoiceData, items, paymentMethods = []) {
    if (!items || items.length === 0) {
        throw new Error('At least one invoice item is required.');
    }

    const { data: { user } } = await supabaseClient.auth.getUser();

    // 1. Insert invoice row (includes discount field)
    const { data: invoice, error: invErr } = await supabaseClient
        .from('invoices')
        .insert([{ ...invoiceData, user_id: user.id, status: 'pending' }])
        .select()
        .single();
    if (invErr) throw invErr;

    // 2. Insert invoice_items rows
    const itemRows = items.map(item => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total: Number(item.quantity) * Number(item.unit_price),
    }));

    const { error: itemErr } = await supabaseClient
        .from('invoice_items')
        .insert(itemRows);
    if (itemErr) throw itemErr;

    // 3. Insert payment methods and accounts
    if (paymentMethods && paymentMethods.length > 0) {
        for (const pm of paymentMethods) {
            const { data: methodRow, error: pmErr } = await supabaseClient
                .from('payment_methods')
                .insert([{ invoice_id: invoice.id, method_type: pm.type }])
                .select()
                .single();
            if (pmErr) throw pmErr;

            if (pm.accounts && pm.accounts.length > 0) {
                const acctRows = pm.accounts.map(acct => ({
                    payment_method_id: methodRow.id,
                    account_name: acct.holder || acct.method || null,
                    account_number: acct.account || acct.number || null,
                    provider: acct.provider || acct.bank || null,
                    branch: acct.branch || null,
                    additional_info: acct.instructions || acct.details || null
                }));
                const { error: acctErr } = await supabaseClient
                    .from('payment_accounts')
                    .insert(acctRows);
                if (acctErr) throw acctErr;
            }
        }
    }

    return invoice;
}

/** Update arbitrary fields on an invoice */
export async function updateInvoice(invoiceId, updates) {
    const { data, error } = await supabaseClient
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/**
 * Mark an invoice as paid.
 * Sets status = 'paid' and records payment_date (defaults to today).
 */
export async function markInvoicePaid(invoiceId, paymentDate = new Date().toISOString().split('T')[0]) {
    return updateInvoice(invoiceId, {
        status: 'paid',
        payment_date: paymentDate,
    });
}

/** Delete an invoice (invoice_items cascade via FK) */
export async function deleteInvoice(invoiceId) {
    const { error } = await supabaseClient
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
    if (error) throw error;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD STATS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Returns summary statistics for the dashboard cards:
 * total, paid count, pending count, total revenue (paid), outstanding balance.
 */
export async function getDashboardStats() {
    const { data, error } = await supabaseClient
        .from('invoices')
        .select('status, total');
    if (error) throw error;

    const stats = {
        total: data.length,
        paid: 0,
        pending: 0,
        revenue: 0,
        outstanding: 0,
    };

    for (const inv of data) {
        if (inv.status === 'paid') {
            stats.paid++;
            stats.revenue += inv.total || 0;
        } else {
            stats.pending++;
            stats.outstanding += inv.total || 0;
        }
    }

    return stats;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUPABASE STORAGE HELPERS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Upload a PDF Blob to the 'documents' storage bucket.
 * The bucket + policies must exist (created via schema.sql).
 * @param {Blob}   pdfBlob - PDF file as a Blob
 * @param {string} path    - Storage path, e.g. 'invoices/INV-0001.pdf'
 */
export async function uploadPdf(pdfBlob, path) {
    const { data, error } = await supabaseClient.storage
        .from('documents')
        .upload(path, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true,
        });
    if (error) throw error;
    return data;
}

/** Get a public URL for a stored PDF */
export function getPdfUrl(path) {
    const { data } = supabaseClient.storage
        .from('documents')
        .getPublicUrl(path);
    return data.publicUrl;
}
