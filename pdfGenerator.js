/**
 * pdfGenerator.js
 * Professional Black & White financial document layout.
 * Corporate accounting style — no color accents, clean typography.
 */

/* ── Constants ─────────────────────────────────────────────────────────── */
const ML = 15, MR = 195, CW = 180;

// Grayscale palette only
const BK = [10, 10, 10];  // near-black body text
const DK = [40, 40, 40];  // dark headings
const MD = [90, 90, 90];  // mid-gray labels
const LT = [150, 150, 150];  // light gray hints
const RUL = [180, 180, 180];  // rule lines
const ALT = [248, 248, 248];  // alternate table row
const TH = [230, 230, 230];  // table header bg

/* ── Helpers ────────────────────────────────────────────────────────────── */
function fmtCurrency(amount) {
    return 'MK ' + Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function hRule(doc, y, x1 = ML, x2 = MR, lw = 0.3, col = RUL) {
    doc.setDrawColor(...col); doc.setLineWidth(lw); doc.line(x1, y, x2, y);
}

function txt(doc, text, x, y, opts = {}) {
    doc.text(String(text ?? ''), x, y, opts);
}

function setFont(doc, style, size, color) {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
}

/** Read logo from localStorage; compute mm size from stored pixel dims. */
function getLogo() {
    const dataUrl = localStorage.getItem('invoiceflow_logo');
    if (!dataUrl) return null;
    const pw = parseFloat(localStorage.getItem('invoiceflow_logo_w') || 0);
    const ph = parseFloat(localStorage.getItem('invoiceflow_logo_h') || 0);
    const MAX_H = 22, MAX_W = 65; // mm
    let h = MAX_H, w;
    if (pw > 0 && ph > 0) {
        const ar = pw / ph;
        w = h * ar;
        if (w > MAX_W) { w = MAX_W; h = w / ar; }
    } else { w = 40; h = 18; }
    const fmt = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    return { dataUrl, w, h, fmt };
}

/** Company info from localStorage with fallbacks */
function company() {
    return {
        name: localStorage.getItem('invoiceflow_company_name') || 'Your Company Name',
        address: localStorage.getItem('invoiceflow_company_address') || 'Company Address, City, Country',
        email: localStorage.getItem('invoiceflow_company_email') || 'company@email.com',
        phone: localStorage.getItem('invoiceflow_company_phone') || '+265 000 000 000',
    };
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVOICE PDF
═══════════════════════════════════════════════════════════════════════════ */
export function generateInvoicePdf(invoice) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const co = company();
    const cl = invoice.clients || {};
    const items = invoice.invoice_items || [];

    const sub = Number(invoice.subtotal || 0);
    const dPct = Number(invoice.discount || 0);
    const dAmt = sub * (dPct / 100);
    const aft = sub - dAmt;
    const tPct = Number(invoice.tax || 0);
    const tAmt = aft * (tPct / 100);
    const tot = aft + tAmt;

    // ── 1. HEADER (two-column layout) ────────────────────────────────────

    let y = 15;

    // RIGHT column: document title + meta
    setFont(doc, 'bold', 26, BK);
    txt(doc, 'INVOICE', MR, y + 9, { align: 'right' });

    setFont(doc, 'normal', 9, MD);
    txt(doc, invoice.invoice_number || '—', MR, y + 17, { align: 'right' });

    let ry = y + 26;
    const metaRows = [
        ['ISSUE DATE', fmtDate(invoice.issue_date)],
        ['DUE DATE', fmtDate(invoice.due_date)],
        ['STATUS', (invoice.status || 'pending').toUpperCase()],
    ];
    metaRows.forEach(([label, val]) => {
        setFont(doc, 'bold', 7, LT);
        txt(doc, label, 145, ry);
        setFont(doc, 'normal', 8.5, DK);
        txt(doc, val, MR, ry, { align: 'right' });
        ry += 7;
    });

    // LEFT column: logo + company info
    let ly = y;
    const logo = getLogo();
    if (logo) {
        try { doc.addImage(logo.dataUrl, logo.fmt, ML, ly, logo.w, logo.h); ly += logo.h + 4; }
        catch { /* skip logo if fails */ }
    }
    setFont(doc, 'bold', 12, BK);
    txt(doc, co.name, ML, ly + 5); ly += 9;
    setFont(doc, 'normal', 8, MD);
    doc.splitTextToSize(co.address, 100).forEach(l => { txt(doc, l, ML, ly); ly += 4.5; });
    txt(doc, co.email, ML, ly); ly += 4.5;
    txt(doc, co.phone, ML, ly); ly += 5;

    y = Math.max(ly, ry) + 6;

    // ── 2. SEPARATOR ─────────────────────────────────────────────────────
    hRule(doc, y, ML, MR, 0.6, BK); y += 8;

    // ── 3. BILL TO ───────────────────────────────────────────────────────
    setFont(doc, 'bold', 7, LT);
    txt(doc, 'BILL TO', ML, y); y += 5.5;

    setFont(doc, 'bold', 11, BK);
    txt(doc, cl.name || '—', ML, y); y += 6;

    setFont(doc, 'normal', 8.5, MD);
    if (cl.address) { doc.splitTextToSize(cl.address, 100).forEach(l => { txt(doc, l, ML, y); y += 4.5; }); }
    if (cl.email) { txt(doc, cl.email, ML, y); y += 4.5; }
    if (cl.phone) { txt(doc, cl.phone, ML, y); y += 4.5; }
    y += 5;

    // ── 4. SEPARATOR ─────────────────────────────────────────────────────
    hRule(doc, y, ML, MR, 0.3, RUL); y += 7;

    // ── 5. ITEMS TABLE ───────────────────────────────────────────────────
    // Column right-edge x-positions
    const CX = { desc: ML + 1, qty: 125, price: 160, amt: MR };
    const ROW_H = 8;

    // Table header
    doc.setFillColor(...TH);
    doc.rect(ML, y - 1.5, CW, ROW_H, 'F');
    setFont(doc, 'bold', 7.5, MD);
    txt(doc, 'DESCRIPTION', CX.desc, y + 4);
    txt(doc, 'QTY', CX.qty, y + 4, { align: 'right' });
    txt(doc, 'UNIT PRICE', CX.price, y + 4, { align: 'right' });
    txt(doc, 'AMOUNT', CX.amt, y + 4, { align: 'right' });
    y += ROW_H;
    hRule(doc, y, ML, MR, 0.4, BK); y += 1;

    // Items
    items.forEach((item, i) => {
        const lineTotal = Number(item.quantity) * Number(item.unit_price);
        const descLines = doc.splitTextToSize(item.description || '', 95);
        const rh = Math.max(ROW_H, descLines.length * 4.5 + 4);

        if (i % 2 === 0) {
            doc.setFillColor(...ALT);
            doc.rect(ML, y, CW, rh, 'F');
        }

        setFont(doc, 'normal', 9, BK);
        doc.text(descLines, CX.desc, y + 5.5);

        setFont(doc, 'normal', 9, MD);
        txt(doc, String(item.quantity), CX.qty, y + 5.5, { align: 'right' });

        setFont(doc, 'normal', 9, BK);
        txt(doc, fmtCurrency(item.unit_price), CX.price, y + 5.5, { align: 'right' });
        txt(doc, fmtCurrency(lineTotal), CX.amt, y + 5.5, { align: 'right' });

        hRule(doc, y + rh, ML, MR, 0.2, [215, 215, 215]);
        y += rh;
    });

    y += 5;

    // ── 6. TOTALS BLOCK (right-aligned) ─────────────────────────────────
    hRule(doc, y, ML, MR, 0.6, BK); y += 8;

    const TX = 148, VX = MR; // label x (right-align), value x (right-align)

    function totRow(label, val, bold = false, size = 9) {
        setFont(doc, 'normal', size - 0.5, MD);
        txt(doc, label, TX, y, { align: 'right' });
        setFont(doc, bold ? 'bold' : 'normal', size, BK);
        txt(doc, val, VX, y, { align: 'right' });
        y += 6.5;
    }

    totRow('Subtotal', fmtCurrency(sub));
    if (dPct > 0) {
        totRow(`Discount (${dPct}%)`, `- ${fmtCurrency(dAmt)}`);
        totRow('After Discount', fmtCurrency(aft));
    }
    totRow(`Tax (${tPct}%)`, fmtCurrency(tAmt));

    hRule(doc, y, 130, MR, 0.5, DK); y += 5;

    // Grand total — bold, larger
    setFont(doc, 'bold', 8.5, MD);
    txt(doc, 'TOTAL DUE', TX, y + 1, { align: 'right' });
    setFont(doc, 'bold', 13, BK);
    txt(doc, fmtCurrency(tot), VX, y + 1, { align: 'right' });
    y += 12;

    // ── 7. FOOTER ────────────────────────────────────────────────────────
    const fy = Math.max(y + 10, 240);
    hRule(doc, fy, ML, MR, 0.6, BK);
    let fY = fy + 6;

    const rawPMs = invoice.payment_methods || [];
    const payMethods = rawPMs.map(pm => {
        const type = pm.type || pm.method_type || 'Unknown';
        let accounts = [];
        if (pm.accounts && Array.isArray(pm.accounts)) {
            // from create-invoice.html
            accounts = pm.accounts.map(a => ({
                name: a.holder || a.method || '',
                number: a.account || a.number || '',
                provider: a.provider || a.bank || '',
                branch: a.branch || '',
                info: a.instructions || a.details || ''
            }));
        } else if (pm.payment_accounts && Array.isArray(pm.payment_accounts)) {
            // from getInvoiceById DB data
            accounts = pm.payment_accounts.map(a => ({
                name: a.account_name || '',
                number: a.account_number || '',
                provider: a.provider || '',
                branch: a.branch || '',
                info: a.additional_info || ''
            }));
        }
        return { type, accounts };
    });

    if (payMethods.length > 0) {
        setFont(doc, 'bold', 8, DK);
        txt(doc, 'PAYMENT INSTRUCTIONS', ML, fY); fY += 5;

        hRule(doc, fY, ML, MR, 0.3, RUL); fY += 4;

        const maxCols = 3;
        const totalCols = Math.min(payMethods.length, maxCols);
        const colWidth = (MR - ML) / (totalCols || 1);
        const centerColWidth = (MR - ML) / maxCols;

        let maxRowHeight = 0;
        let startYGrid = fY;

        payMethods.forEach((pm, idx) => {
            const colIndex = idx % maxCols;
            if (colIndex === 0 && idx > 0) {
                startYGrid += maxRowHeight + 6;
                maxRowHeight = 0;
            }

            let bX = ML + (colIndex * colWidth);
            let activeColWidth = colWidth;
            if (payMethods.length === 1) {
                activeColWidth = centerColWidth;
                bX = ML + ((MR - ML) / 2) - (activeColWidth / 2);
            }

            let boxY = startYGrid;

            setFont(doc, 'bold', 8.5, BK);
            txt(doc, pm.type, bX, boxY); boxY += 4.5;

            pm.accounts.forEach((acct, aIdx) => {
                if (aIdx > 0) boxY += 2;

                if (pm.type === 'Cash') {
                    setFont(doc, 'normal', 7.5, MD);
                    const msgs = doc.splitTextToSize(acct.info || 'Cash payments accepted. A receipt will be issued.', activeColWidth - 5);
                    msgs.forEach(l => { txt(doc, l, bX, boxY); boxY += 3.5; });
                } else if (pm.type !== 'Bank Transfer' && pm.type !== 'Mobile Money' && !acct.provider) {
                    setFont(doc, 'bold', 7.5, BK);
                    txt(doc, '• ' + (acct.name || pm.type), bX, boxY); boxY += 3.5;
                    if (acct.info) {
                        setFont(doc, 'normal', 7.5, MD);
                        const dLines = doc.splitTextToSize(acct.info, activeColWidth - 5);
                        dLines.forEach(l => { txt(doc, l, bX + 3, boxY); boxY += 3.5; });
                    }
                } else {
                    const titleStr = acct.provider || '';
                    if (titleStr) {
                        setFont(doc, 'bold', 7.5, BK);
                        txt(doc, '• ' + titleStr, bX, boxY); boxY += 3.5;
                    } else if (pm.accounts.length > 1) {
                        setFont(doc, 'bold', 7.5, BK);
                        txt(doc, '• Account ' + (aIdx + 1), bX, boxY); boxY += 3.5;
                    }

                    setFont(doc, 'normal', 7.5, MD);
                    if (acct.name) { txt(doc, (pm.type === 'Bank Transfer' ? 'Account Name: ' : 'Name: ') + acct.name, bX + 3, boxY); boxY += 3.5; }
                    if (acct.number) { txt(doc, (pm.type === 'Bank Transfer' ? 'Account No: ' : 'Number: ') + acct.number, bX + 3, boxY); boxY += 3.5; }
                    if (acct.branch) { txt(doc, 'Branch: ' + acct.branch, bX + 3, boxY); boxY += 3.5; }
                    if (acct.info) {
                        const dLines = doc.splitTextToSize(acct.info, activeColWidth - 5);
                        dLines.forEach(l => { txt(doc, l, bX + 3, boxY); boxY += 3.5; });
                    }
                }
            });

            const blockHeight = boxY - startYGrid;
            if (blockHeight > maxRowHeight) maxRowHeight = blockHeight;
        });

        fY = startYGrid + maxRowHeight + 2;

    } else {
        // Fallback: generic payment text
        setFont(doc, 'bold', 7.5, DK);
        txt(doc, 'PAYMENT TERMS & INSTRUCTIONS', ML, fY); fY += 5;
        setFont(doc, 'normal', 8.5, MD);
        const payTerms = localStorage.getItem('invoiceflow_payment_terms') ||
            'Payment is due within 30 days of the invoice date.';
        const termLines = doc.splitTextToSize(payTerms, CW);
        termLines.forEach(l => { txt(doc, l, ML, fY); fY += 4.5; });
        fY += 3;
        txt(doc, 'Accepted Payment Methods:  Bank Transfer  |  Mobile Money  |  Cash', ML, fY); fY += 8;
    }

    fY += 3;
    setFont(doc, 'italic', 8, MD);
    txt(doc, 'Thank you for your business. All amounts are in Malawi Kwacha (MWK).', ML, fY); fY += 10;

    // Notes block
    const invoiceNotes = invoice.notes || '';
    if (invoiceNotes) {
        setFont(doc, 'bold', 7.5, DK);
        txt(doc, 'NOTES', ML, fY); fY += 5;
        setFont(doc, 'normal', 8, MD);
        const noteLines = doc.splitTextToSize(invoiceNotes, CW);
        noteLines.forEach(l => { txt(doc, l, ML, fY); fY += 4.5; });
        fY += 6;
    }

    // Signature line
    hRule(doc, fY, 130, MR, 0.5, DK);
    fY += 4;
    setFont(doc, 'normal', 7.5, LT);
    txt(doc, 'Authorized Signature', MR, fY, { align: 'right' });

    // Page footer
    setFont(doc, 'normal', 7, LT);
    txt(doc, `${invoice.invoice_number || 'Invoice'} • ${fmtDate(new Date().toISOString().split('T')[0])} • InvoiceFlow`, 105, 291, { align: 'center' });

    return doc;
}

/* ---- RECEIPT PDF----------*/
export function generateReceiptPdf(invoice, paymentMethod = 'Bank Transfer') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const co = company();
    const cl = invoice.clients || {};
    const rcN = `REC-${(invoice.invoice_number || 'XXXX').replace('INV-', '')}`;

    const sub = Number(invoice.subtotal || 0);
    const dPct = Number(invoice.discount || 0);
    const dAmt = sub * (dPct / 100);
    const aft = sub - dAmt;
    const tPct = Number(invoice.tax || 0);
    const tAmt = aft * (tPct / 100);
    const tot = aft + tAmt;

    // ── 1. HEADER ────────────────────────────────────────────────────────
    let y = 15;

    // RIGHT: RECEIPT heading + meta
    setFont(doc, 'bold', 26, BK);
    txt(doc, 'RECEIPT', MR, y + 9, { align: 'right' });
    setFont(doc, 'normal', 9, MD);
    txt(doc, rcN, MR, y + 17, { align: 'right' });

    let ry = y + 26;
    [
        ['PAYMENT DATE', fmtDate(invoice.payment_date)],
        ['INVOICE REF.', invoice.invoice_number || '—'],
        ['PAY METHOD', paymentMethod],
    ].forEach(([label, val]) => {
        setFont(doc, 'bold', 7, LT); txt(doc, label, 145, ry);
        setFont(doc, 'normal', 8.5, DK); txt(doc, val, MR, ry, { align: 'right' });
        ry += 7;
    });

    // LEFT: logo + company
    let ly = y;
    const logo = getLogo();
    if (logo) {
        try { doc.addImage(logo.dataUrl, logo.fmt, ML, ly, logo.w, logo.h); ly += logo.h + 4; }
        catch { /* skip */ }
    }
    setFont(doc, 'bold', 12, BK); txt(doc, co.name, ML, ly + 5); ly += 9;
    setFont(doc, 'normal', 8, MD);
    doc.splitTextToSize(co.address, 100).forEach(l => { txt(doc, l, ML, ly); ly += 4.5; });
    txt(doc, co.email, ML, ly); ly += 4.5;
    txt(doc, co.phone, ML, ly); ly += 5;

    y = Math.max(ly, ry) + 6;

    // ── 2. SEPARATOR ─────────────────────────────────────────────────────
    hRule(doc, y, ML, MR, 0.6, BK); y += 8;

    // ── 3. PAID WATERMARK (gray, rotated) ────────────────────────────────
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.07 }));
    setFont(doc, 'bold', 80, [50, 50, 50]);
    doc.text('PAID', 105, 155, { align: 'center', angle: 30 });
    doc.restoreGraphicsState();

    // Bordered PAID stamp box
    doc.saveGraphicsState();
    doc.setDrawColor(...DK); doc.setLineWidth(1.5);
    doc.roundedRect(130, y - 4, 65, 14, 1, 1, 'S');
    setFont(doc, 'bold', 11, DK);
    txt(doc, 'PAID IN FULL', 162, y + 5.5, { align: 'center' });
    doc.restoreGraphicsState();

    // ── 4. BILL TO ───────────────────────────────────────────────────────
    setFont(doc, 'bold', 7, LT); txt(doc, 'RECEIVED FROM', ML, y); y += 5.5;
    setFont(doc, 'bold', 11, BK); txt(doc, cl.name || '—', ML, y); y += 6;
    setFont(doc, 'normal', 8.5, MD);
    if (cl.address) { doc.splitTextToSize(cl.address, 100).forEach(l => { txt(doc, l, ML, y); y += 4.5; }); }
    if (cl.email) { txt(doc, cl.email, ML, y); y += 4.5; }
    if (cl.phone) { txt(doc, cl.phone, ML, y); y += 4.5; }
    y += 6;

    // ── 5. SEPARATOR ─────────────────────────────────────────────────────
    hRule(doc, y, ML, MR, 0.3, RUL); y += 7;

    // ── 6. PAYMENT SUMMARY TABLE ─────────────────────────────────────────
    // Header
    doc.setFillColor(...TH);
    doc.rect(ML, y - 1.5, CW, 8, 'F');
    setFont(doc, 'bold', 7.5, MD);
    txt(doc, 'DESCRIPTION', ML + 1, y + 4);
    txt(doc, 'AMOUNT', MR, y + 4, { align: 'right' });
    y += 9;
    hRule(doc, y, ML, MR, 0.4, BK); y += 2;

    const summaryRows = [['Invoice Subtotal', fmtCurrency(sub)]];
    if (dPct > 0) {
        summaryRows.push([`Discount (${dPct}%)`, `- ${fmtCurrency(dAmt)}`]);
        summaryRows.push(['After Discount', fmtCurrency(aft)]);
    }
    summaryRows.push([`Tax (${tPct}%)`, fmtCurrency(tAmt)]);

    summaryRows.forEach(([label, val], i) => {
        if (i % 2 === 0) { doc.setFillColor(...ALT); doc.rect(ML, y, CW, 8, 'F'); }
        setFont(doc, 'normal', 9, BK); txt(doc, label, ML + 1, y + 5.5);
        setFont(doc, 'normal', 9, MD); txt(doc, val, MR, y + 5.5, { align: 'right' });
        hRule(doc, y + 8, ML, MR, 0.2, [215, 215, 215]);
        y += 8;
    });

    y += 4;
    hRule(doc, y, ML, MR, 0.6, BK); y += 6;

    // TOTAL PAID row
    setFont(doc, 'bold', 9, MD);
    txt(doc, 'TOTAL AMOUNT PAID', ML + 1, y + 1);
    setFont(doc, 'bold', 13, BK);
    txt(doc, fmtCurrency(tot), MR, y + 1, { align: 'right' });
    y += 12;

    hRule(doc, y, ML, MR, 0.3, RUL); y += 7;

    // ── 7. CONFIRMATION TEXT ─────────────────────────────────────────────
    setFont(doc, 'italic', 9, MD);
    txt(doc, `This receipt confirms that payment of ${fmtCurrency(tot)} was received in full`, ML, y); y += 5;
    txt(doc, `on ${fmtDate(invoice.payment_date)} via ${paymentMethod}.`, ML, y); y += 5;
    txt(doc, 'All amounts are in Malawi Kwacha (MWK). Please retain this receipt for your records.', ML, y); y += 12;

    // ── 8. FOOTER ────────────────────────────────────────────────────────
    const fy = Math.max(y + 6, 255);
    hRule(doc, fy, ML, MR, 0.6, BK);
    let fY = fy + 6;

    setFont(doc, 'normal', 8.5, MD);
    txt(doc, 'For any queries regarding this receipt, please contact us at ' + co.email + ' or ' + co.phone, ML, fY); fY += 12;

    // Signature line
    hRule(doc, fY, 130, MR, 0.5, DK); fY += 4;
    setFont(doc, 'normal', 7.5, LT);
    txt(doc, 'Authorized Signature', MR, fY, { align: 'right' });

    // Page footer
    setFont(doc, 'normal', 7, LT);
    txt(doc, `${rcN} • Ref: ${invoice.invoice_number || '—'} • InvoiceFlow`, 105, 291, { align: 'center' });

    return doc;
}

/* ── Download helpers ────────────────────────────────────────────────── */
export function downloadInvoicePdf(invoice) {
    const doc = generateInvoicePdf(invoice);
    doc.save(`${invoice.invoice_number || 'invoice'}.pdf`);
    return doc;
}

export function downloadReceiptPdf(invoice, paymentMethod) {
    const doc = generateReceiptPdf(invoice, paymentMethod);
    const rcN = `REC-${(invoice.invoice_number || 'XXXX').replace('INV-', '')}`;
    doc.save(`${rcN}.pdf`);
    return doc;
}

export function docToBlob(doc) {
    return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}
