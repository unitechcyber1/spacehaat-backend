import mongoose from 'mongoose';
import models from '../../models/index.js';
import manageBillingProfile from './manage-billing-profile.js';
import manageProductCatalog from './manage-product-catalog.js';
import razerPay from '../../utilities/razerPay.js';
import aws from '../../utilities/aws.js';
import storage from '../../config/storage.js';
import { renderInvoiceHtml, renderInvoicePrintHtml } from '../../utilities/invoice/invoiceHtml.js';
import { generateInvoicePdfBuffer } from '../../utilities/invoice/invoicePdf.js';
import {
    buildDefaultInvoiceTerms,
    hasShipToSection,
    invoicePdfFilename,
    resolveInvoiceTerms,
} from '../../utilities/invoice/invoiceFormat.js';
import { nextInvoiceNumber, peekNextInvoiceNumber } from '../../utilities/invoice/invoiceNumber.js';
import {
    applyTotalsToInvoicePayload,
    buildBuyerSnapshotFromCustomer,
    buildDefaultLineItemsFromCustomer,
    buildIdempotencyKey,
    getInvoiceSeriesPrefix,
    isInvoiceEligibleSpaceType,
    resolveBillingForInvoice,
} from '../../utilities/invoice/buildInvoiceFromCustomer.js';
import {
    applyTotalsToBillingClientInvoice,
    buildBillingSnapshotFromBillingClient,
    buildBuyerSnapshotFromBillingClient,
    buildDefaultLineItemsForBillingClient,
    buildIdempotencyKeyForBillingClient,
    buildShipToSnapshotFromBillingClient,
} from '../../utilities/invoice/buildInvoiceFromBillingClient.js';
import manageBillingClient from './manage-billing-client.js';
import { resolveSellerStateCode } from '../../utilities/invoice/resolveBillingState.js';
import mail from '../../config/mail.js';
import emailTemplates from '../../utilities/emailTemplate.js';
import {
    buildDefaultInvoiceEmailSubject,
    buildInvoiceEmailHtmlVariables,
    normalizeEmailList,
    validateInvoiceSendPayload,
} from '../../utilities/invoice/invoiceEmail.js';
import {
    applyCreatedByScope,
    assertBillingRecordAccess,
} from '../../utilities/billing/billingAccess.js';

const { ObjectId } = mongoose.Types;
const Invoice = models['Invoice'];
const Customer = models['Customer'];
const ClientBillingProfile = models['ClientBillingProfile'];
const BillingClient = models['BillingClient'];

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function pushEvent(invoice, event, actor, note) {
    invoice.events = invoice.events || [];
    invoice.events.push({ event, actor, note, at: new Date() });
}

class ManageInvoiceService {
    constructor() {
        return {
            getMeta: this.getMeta.bind(this),
            getInvoiceNumberPreview: this.getInvoiceNumberPreview.bind(this),
            list: this.list.bind(this),
            getById: this.getById.bind(this),
            getHtml: this.getHtml.bind(this),
            getPreview: this.getPreview.bind(this),
            getPdf: this.getPdf.bind(this),
            generatePdf: this.generatePdf.bind(this),
            createDraftFromCustomer: this.createDraftFromCustomer.bind(this),
            createDraftFromBillingClient: this.createDraftFromBillingClient.bind(this),
            createDraft: this.createDraft.bind(this),
            updateDraft: this.updateDraft.bind(this),
            issue: this.issue.bind(this),
            send: this.send.bind(this),
            getSendPrefill: this.getSendPrefill.bind(this),
            createPaymentLink: this.createPaymentLink.bind(this),
            markPaid: this.markPaid.bind(this),
            cancel: this.cancel.bind(this),
            upsertClientBilling: this.upsertClientBilling.bind(this),
            getClientBilling: this.getClientBilling.bind(this),
            convertToTaxInvoice: this.convertToTaxInvoice.bind(this),
        };
    }

    _throw(msg, code = 400) {
        throw { name: 'cofynd', code, message: msg };
    }

    async _loadInvoiceForActor(id, actorUser) {
        if (!id || !ObjectId.isValid(id)) this._throw('Invalid id');
        const invoice = await Invoice.findById(id);
        if (!invoice) this._throw('Invoice not found', 404);
        assertBillingRecordAccess(invoice, actorUser);
        return invoice;
    }

    _applyBuyerSnapshotFromClient(invoice, client) {
        const shipTo = buildShipToSnapshotFromBillingClient(client);
        const current = invoice.billing_snapshot;
        const base = current && typeof current.toObject === 'function'
            ? current.toObject()
            : { ...(current || {}) };
        const next = {
            ...base,
            buyer: buildBuyerSnapshotFromBillingClient(client),
        };
        if (shipTo) next.ship_to = shipTo;
        else delete next.ship_to;
        invoice.billing_snapshot = next;
        if (typeof invoice.markModified === 'function') {
            invoice.markModified('billing_snapshot');
        }
    }

    async _syncBillingClientSnapshot(target, actorUser) {
        if (!target?.billingClientId || !ObjectId.isValid(String(target.billingClientId))) return;
        if (!actorUser) return;
        try {
            const client = await manageBillingClient.getById({ id: target.billingClientId, actorUser });
            if (typeof target.markModified === 'function') {
                this._applyBuyerSnapshotFromClient(target, client);
            } else {
                const shipTo = buildShipToSnapshotFromBillingClient(client);
                target.billing_snapshot = target.billing_snapshot || {};
                target.billing_snapshot.buyer = buildBuyerSnapshotFromBillingClient(client);
                if (shipTo) target.billing_snapshot.ship_to = shipTo;
                else delete target.billing_snapshot.ship_to;
            }
        } catch {
            // Keep stored snapshot if client cannot be loaded.
        }
    }

    async _mergeMissingShipToFromClient(doc, actorUser) {
        if (!actorUser || !doc?.billingClientId || hasShipToSection(doc.billing_snapshot?.ship_to)) return;
        try {
            const client = await manageBillingClient.getById({ id: doc.billingClientId, actorUser });
            const shipTo = buildShipToSnapshotFromBillingClient(client);
            if (!shipTo) return;
            doc.billing_snapshot = { ...(doc.billing_snapshot || {}), ship_to: shipTo };
        } catch {
            // ignore
        }
    }

    async _enrichInvoiceForRender(invoice, actorUser) {
        const doc = typeof invoice?.toObject === 'function' ? invoice.toObject() : { ...invoice };
        if (doc.status === 'draft' && actorUser) {
            await this._syncBillingClientSnapshot(doc, actorUser);
        } else if (actorUser) {
            await this._mergeMissingShipToFromClient(doc, actorUser);
        }
        const billingProfile = await manageBillingProfile.getOrCreate();
        const seller = doc.billing_snapshot?.seller;
        if (seller) {
            doc.billing_snapshot = {
                ...doc.billing_snapshot,
                seller: {
                    ...seller,
                    phone: billingProfile.phone || seller.phone,
                    cin: billingProfile.cin || seller.cin,
                    website: billingProfile.website || seller.website,
                    ...(billingProfile?.bank_details ? {
                        bank_details: {
                            ...seller.bank_details,
                            ...billingProfile.bank_details,
                            address: {
                                ...seller.bank_details?.address,
                                ...billingProfile.bank_details?.address,
                            },
                        },
                    } : {}),
                },
            };
        }
        doc.terms = resolveInvoiceTerms(doc, billingProfile);
        return doc;
    }

    async getMeta() {
        await manageProductCatalog.seedDefaults();
        const billingProfile = await manageBillingProfile.getOrCreate();
        return {
            billingProfile,
            stateProfiles: billingProfile.state_profiles || [],
            spaceTypes: ['Coworking Space', 'Office Space', 'PG', 'Coliving Space', 'Virtual Office'],
            invoiceStatuses: ['draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled', 'voided'],
            invoiceTypes: ['client', 'proforma'],
            sources: ['deal_done', 'renewal', 'manual', 'adjustment'],
            taxModes: ['intra_state', 'inter_state'],
            pricingMode: 'manual',
            supplier: 'SpaceHaat',
            billingClientRequired: true,
            invoiceCreationMode: 'billing_client',
            default_payment_terms_days: billingProfile.default_payment_terms_days || 7,
            default_late_payment_interest_rate: billingProfile.default_late_payment_interest_rate ?? 18,
            default_invoice_terms: buildDefaultInvoiceTerms(billingProfile),
            invoiceEmail: {
                supportsCustomRecipients: true,
                supportsCc: true,
                supportsBcc: true,
                supportsPdfAttachment: true,
                supportsCustomMessage: true,
                prefillEndpoint: 'GET /invoices/:id/send/prefill',
            },
        };
    }

    _resolveSellerStateForSeries(invoiceOrCode, billingProfile) {
        const explicit = typeof invoiceOrCode === 'object'
            ? invoiceOrCode?.seller_state_code
            : invoiceOrCode;
        const code = resolveSellerStateCode({
            explicitCode: explicit,
            billingProfile,
        });
        if (!code) {
            this._throw(
                'Bill From GST state (seller_state_code) is required. Select a SpaceHaat state profile in billing settings or on the invoice.',
                400
            );
        }
        return code;
    }

    _buildSeriesPrefix({ billingProfile, spaceType, invoiceType, sellerStateCode }) {
        return getInvoiceSeriesPrefix({
            billingProfile,
            spaceType,
            invoiceType,
            sellerStateCode,
        });
    }

    async getInvoiceNumberPreview({
        space_type = 'Coworking Space',
        invoice_type = 'client',
        seller_state_code,
    }) {
        const billingProfile = await manageBillingProfile.getOrCreate();
        const type = invoice_type === 'proforma' ? 'proforma' : 'client';
        const resolvedSellerCode = this._resolveSellerStateForSeries(seller_state_code, billingProfile);
        const prefix = this._buildSeriesPrefix({
            billingProfile,
            spaceType: space_type,
            invoiceType: type,
            sellerStateCode: resolvedSellerCode,
        });
        const preview = await peekNextInvoiceNumber({ prefix });
        return {
            ...preview,
            seller_state_code: resolvedSellerCode,
            space_type,
            invoice_type: type,
        };
    }

    _applyTotalsToInvoice(invoice, lineItems, billingProfile) {
        const buyer = invoice.billing_snapshot?.buyer || {};
        const sellerCode = invoice.seller_state_code;
        const totals = applyTotalsToInvoicePayload(lineItems, sellerCode, buyer);
        invoice.line_items = totals.line_items;
        invoice.subtotal = totals.subtotal;
        invoice.discount_total = totals.discount_total;
        invoice.taxable_amount = totals.taxable_amount;
        invoice.cgst = totals.cgst;
        invoice.sgst = totals.sgst;
        invoice.igst = totals.igst;
        invoice.total = totals.total;
        invoice.balance_due = totals.balance_due;
        invoice.tax_mode = totals.tax_mode;
    }

    async _loadBillingContext(customerId) {
        const [customer, billingProfile, clientBilling] = await Promise.all([
            Customer.findById(customerId).lean(),
            manageBillingProfile.getOrCreate(),
            ClientBillingProfile.findOne({ customerId }).lean(),
        ]);
        if (!customer) this._throw('Customer not found', 404);
        return { customer, billingProfile, clientBilling };
    }

    async upsertClientBilling({ customerId, ...payload }) {
        if (!customerId || !ObjectId.isValid(customerId)) this._throw('Invalid customerId');
        const customer = await Customer.findById(customerId).lean();
        if (!customer) this._throw('Customer not found', 404);

        const billing_name = payload.billing_name || customer.client?.name;
        if (!billing_name) this._throw('billing_name is required');

        const doc = await ClientBillingProfile.findOneAndUpdate(
            { customerId },
            {
                $set: {
                    billing_name,
                    billing_email: payload.billing_email || customer.client?.email,
                    billing_phone: payload.billing_phone || customer.client?.contact,
                    company_name: payload.company_name || customer.client?.company_name,
                    gstin: payload.gstin,
                    pan: payload.pan,
                    is_gst_registered: !!payload.is_gst_registered,
                    billing_address: payload.billing_address || {
                        city: customer.location?.city,
                        state: payload.place_of_supply_state,
                        state_code: payload.place_of_supply_state_code,
                    },
                    place_of_supply_state: payload.place_of_supply_state,
                    place_of_supply_state_code: payload.place_of_supply_state_code,
                },
            },
            { upsert: true, new: true }
        );
        return doc;
    }

    async getClientBilling({ customerId }) {
        if (!customerId || !ObjectId.isValid(customerId)) this._throw('Invalid customerId');
        return ClientBillingProfile.findOne({ customerId }).lean();
    }

    async createDraftFromCustomer({
        customerId,
        source = 'manual',
        line_items,
        notes,
        created_by,
        skipIfExists = true,
        seller_state_code,
        invoice_type = 'client',
        commercial,
    }) {
        const { customer, billingProfile, clientBilling } = await this._loadBillingContext(customerId);

        if (!isInvoiceEligibleSpaceType(customer.space_type)) {
            this._throw(`Invoicing not enabled for space_type: ${customer.space_type}`);
        }

        const idempotency_key = buildIdempotencyKey({
            customerId: customer._id,
            source,
            periodStart: customer.start_date || new Date(),
        });

        if (skipIfExists) {
            const existing = await Invoice.findOne({ idempotency_key }).lean();
            if (existing) return existing;
        }

        if (!clientBilling) {
            await this.upsertClientBilling({ customerId: customer._id });
        }
        const billing = clientBilling || await ClientBillingProfile.findOne({ customerId }).lean();

        const { seller_state_code: resolvedSellerCode, sellerSnapshot } = resolveBillingForInvoice(
            billingProfile,
            { seller_state_code }
        );

        const catalog = await manageProductCatalog.list({
            space_type: customer.space_type,
            enabled: true,
            limit: 20,
        });

        const items = line_items?.length
            ? line_items
            : buildDefaultLineItemsFromCustomer(customer, catalog.data);

        if (!items.length) this._throw('No line items could be generated');

        const buyerSnapshot = buildBuyerSnapshotFromCustomer(customer, billing);
        const totals = applyTotalsToInvoicePayload(items, resolvedSellerCode, buyerSnapshot);

        const paymentTerms = billingProfile.default_payment_terms_days || 7;
        const defaultTerms = buildDefaultInvoiceTerms(billingProfile);

        const invoice = await Invoice.create({
            invoice_type: invoice_type === 'proforma' ? 'proforma' : 'client',
            status: 'draft',
            party_type: 'client',
            customerId: customer._id,
            enquiryId: customer.enquiryId,
            client_billing_profile_id: billing?._id,
            seller_state_code: resolvedSellerCode,
            space_type: customer.space_type,
            source,
            idempotency_key,
            due_date: addDays(new Date(), paymentTerms),
            billing_snapshot: {
                seller: sellerSnapshot,
                buyer: buyerSnapshot,
            },
            line_items: totals.line_items,
            subtotal: totals.subtotal,
            discount_total: totals.discount_total,
            taxable_amount: totals.taxable_amount,
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            total: totals.total,
            balance_due: totals.balance_due,
            tax_mode: totals.tax_mode,
            commercial: commercial || {},
            notes,
            terms: defaultTerms,
            html_snapshot: '',
            created_by,
            events: [{ event: 'created', at: new Date(), note: `source:${source}` }],
        });

        invoice.html_snapshot = renderInvoiceHtml(invoice.toObject());
        await invoice.save();
        return invoice;
    }

    async createDraftFromBillingClient({
        billingClientId,
        billing_client,
        source = 'manual',
        line_items,
        notes,
        created_by,
        skipIfExists = false,
        seller_state_code,
        invoice_type = 'client',
        space_type,
        commercial,
        terms,
        due_date,
        issue_date,
        actorUser,
    }) {
        const { client } = await manageBillingClient.findOrCreate({
            billingClientId,
            ...billing_client,
            created_by,
            actorUser,
        });

        const resolvedSpaceType = space_type || client.default_space_type || 'Coworking Space';
        if (!['Coworking Space', 'Office Space', 'PG', 'Coliving Space', 'Virtual Office'].includes(resolvedSpaceType)) {
            this._throw(`Invoicing not enabled for space_type: ${resolvedSpaceType}`);
        }

        const idempotency_key = buildIdempotencyKeyForBillingClient({
            billingClientId: client._id,
            source,
            periodStart: new Date(),
        });

        if (skipIfExists) {
            const existing = await Invoice.findOne({ idempotency_key }).lean();
            if (existing) {
                assertBillingRecordAccess(existing, actorUser);
                return existing;
            }
        }

        const billingProfile = await manageBillingProfile.getOrCreate();
        const { seller_state_code: resolvedSellerCode, sellerSnapshot } = resolveBillingForInvoice(
            billingProfile,
            { seller_state_code }
        );

        const catalog = await manageProductCatalog.list({
            space_type: resolvedSpaceType,
            enabled: true,
            limit: 20,
        });

        const items = line_items?.length
            ? line_items
            : buildDefaultLineItemsForBillingClient({
                space_type: resolvedSpaceType,
                catalogItems: catalog.data,
            });

        if (!items.length) this._throw('No line items could be generated');

        const totals = applyTotalsToBillingClientInvoice(items, resolvedSellerCode, client);
        const defaultTerms = buildDefaultInvoiceTerms(billingProfile);
        const resolvedIssueDate = issue_date ? new Date(issue_date) : new Date();
        if (!due_date) {
            this._throw('due_date is required');
        }
        const resolvedDueDate = new Date(due_date);

        const invoice = await Invoice.create({
            invoice_type: invoice_type === 'proforma' ? 'proforma' : 'client',
            status: 'draft',
            party_type: 'client',
            billingClientId: client._id,
            seller_state_code: resolvedSellerCode,
            space_type: resolvedSpaceType,
            source,
            idempotency_key,
            issue_date: resolvedIssueDate,
            due_date: resolvedDueDate,
            billing_snapshot: buildBillingSnapshotFromBillingClient(client, sellerSnapshot),
            line_items: totals.line_items,
            subtotal: totals.subtotal,
            discount_total: totals.discount_total,
            taxable_amount: totals.taxable_amount,
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            total: totals.total,
            balance_due: totals.balance_due,
            tax_mode: totals.tax_mode,
            commercial: commercial || {},
            notes,
            terms: terms || defaultTerms,
            html_snapshot: '',
            created_by,
            events: [{ event: 'created', at: new Date(), note: `billing_client:${source}` }],
        });

        invoice.html_snapshot = renderInvoiceHtml(invoice.toObject());
        await invoice.save();
        return invoice;
    }

    async createDraft(payload) {
        const {
            billingClientId,
            billing_client,
            customerId,
            line_items,
            actorUser,
            ...rest
        } = payload;

        if (customerId) {
            if (!line_items?.length) this._throw('line_items required for manual draft');
            return this.createDraftFromCustomer({
                customerId,
                source: rest.source || 'manual',
                line_items,
                notes: rest.notes,
                created_by: rest.created_by,
                skipIfExists: false,
                seller_state_code: rest.seller_state_code,
                invoice_type: rest.invoice_type,
                commercial: rest.commercial,
            });
        }

        if (!billingClientId && !billing_client?.billing_name) {
            this._throw('billingClientId or billing_client.billing_name is required');
        }

        return this.createDraftFromBillingClient({
            billingClientId,
            billing_client,
            source: rest.source || 'manual',
            line_items,
            notes: rest.notes,
            created_by: rest.created_by,
            skipIfExists: false,
            seller_state_code: rest.seller_state_code,
            invoice_type: rest.invoice_type,
            space_type: rest.space_type,
            commercial: rest.commercial,
            terms: rest.terms,
            actorUser,
        });
    }

    async updateDraft({
        id,
        line_items,
        notes,
        terms,
        due_date,
        issue_date,
        seller_state_code,
        commercial,
        billingClientId,
        invoice_type,
        actorUser,
    }) {
        const invoice = await this._loadInvoiceForActor(id, actorUser);
        // Allow edits after issue for operational fixes (e.g. billing details, dates, line items).
        // Disallow edits only once invoice is financially finalized.
        if (['paid', 'cancelled', 'voided'].includes(invoice.status)) {
            this._throw(`Invoices in status "${invoice.status}" cannot be edited`);
        }

        const billingProfile = await manageBillingProfile.getOrCreate();

        if (typeof invoice_type !== 'undefined') {
            invoice.invoice_type = invoice_type === 'proforma' ? 'proforma' : 'client';
        }

        if (typeof seller_state_code !== 'undefined') {
            const { seller_state_code: code, sellerSnapshot } = resolveBillingForInvoice(
                billingProfile,
                { seller_state_code }
            );
            invoice.seller_state_code = code;
            invoice.billing_snapshot = invoice.billing_snapshot || {};
            invoice.billing_snapshot.seller = sellerSnapshot;
        }

        if (typeof notes !== 'undefined') invoice.notes = notes;
        if (typeof terms !== 'undefined') invoice.terms = terms;
        if (typeof due_date !== 'undefined') {
            invoice.due_date = due_date ? new Date(due_date) : undefined;
        }
        if (typeof issue_date !== 'undefined') {
            invoice.issue_date = issue_date ? new Date(issue_date) : undefined;
        }
        if (typeof commercial !== 'undefined') invoice.commercial = commercial;

        if (billingClientId && ObjectId.isValid(billingClientId)) {
            const client = await manageBillingClient.getById({ id: billingClientId, actorUser });
            invoice.billingClientId = client._id;
            this._applyBuyerSnapshotFromClient(invoice, client);
        } else if (invoice.billingClientId && ObjectId.isValid(String(invoice.billingClientId))) {
            await this._syncBillingClientSnapshot(invoice, actorUser);
        }

        if (line_items?.length) {
            this._applyTotalsToInvoice(invoice, line_items, billingProfile);
        } else if (typeof seller_state_code !== 'undefined' || billingClientId) {
            this._applyTotalsToInvoice(invoice, invoice.line_items, billingProfile);
        }

        pushEvent(invoice, 'updated');
        invoice.html_snapshot = renderInvoiceHtml(invoice.toObject());
        await invoice.save();

        // If already issued/sent/etc, regenerate stored PDF so download matches latest edits.
        if (invoice.status !== 'draft') {
            this.generatePdf({ id: invoice._id, store: true, actorUser }).catch((err) => {
                console.error('Post-edit PDF generation failed:', err?.message || err);
            });
        }
        return invoice;
    }

    async issue({ id, invoice_type, created_by, actorUser }) {
        const invoice = await this._loadInvoiceForActor(id, actorUser);
        if (invoice.status !== 'draft') this._throw('Only draft invoices can be issued');
        if (invoice.invoice_number) this._throw('Invoice already issued');

        if (Number(invoice.total) <= 0) {
            this._throw('Enter line item amounts before issuing (total must be > 0)');
        }

        await this._syncBillingClientSnapshot(invoice, actorUser);

        const billingProfile = await manageBillingProfile.getOrCreate();
        const type = invoice_type === 'proforma' || invoice.invoice_type === 'proforma'
            ? 'proforma'
            : 'client';
        invoice.invoice_type = type;

        const sellerCode = this._resolveSellerStateForSeries(invoice, billingProfile);
        if (!invoice.seller_state_code) {
            invoice.seller_state_code = sellerCode;
        }

        const prefix = this._buildSeriesPrefix({
            billingProfile,
            spaceType: invoice.space_type,
            invoiceType: type,
            sellerStateCode: sellerCode,
        });
        const { invoice_number, series_key } = await nextInvoiceNumber({ prefix });

        invoice.invoice_number = invoice_number;
        invoice.series_key = series_key;
        if (type === 'proforma') invoice.proforma_invoice_number = invoice_number;
        invoice.status = 'issued';
        invoice.issue_date = new Date();
        if (!invoice.due_date) {
            invoice.due_date = addDays(invoice.issue_date, billingProfile.default_payment_terms_days || 7);
        }

        pushEvent(invoice, 'issued', created_by, type);
        const renderDoc = await this._enrichInvoiceForRender(invoice, actorUser);
        invoice.html_snapshot = renderInvoiceHtml(renderDoc);
        await invoice.save();

        this.generatePdf({ id: invoice._id, store: true, actorUser }).catch((err) => {
            console.error('Post-issue PDF generation failed:', err?.message || err);
        });

        return invoice;
    }

    async convertToTaxInvoice({ id, created_by, actorUser }) {
        const invoice = await this._loadInvoiceForActor(id, actorUser);
        if (invoice.invoice_type !== 'proforma') {
            this._throw('Only proforma invoices can be converted to tax invoice');
        }
        if (invoice.converted_to_tax_at) {
            this._throw('Already converted to tax invoice');
        }

        const billingProfile = await manageBillingProfile.getOrCreate();
        const sellerCode = this._resolveSellerStateForSeries(invoice, billingProfile);
        if (!invoice.seller_state_code) {
            invoice.seller_state_code = sellerCode;
        }

        const prefix = this._buildSeriesPrefix({
            billingProfile,
            spaceType: invoice.space_type,
            invoiceType: 'client',
            sellerStateCode: sellerCode,
        });
        const { invoice_number, series_key } = await nextInvoiceNumber({ prefix });

        if (!invoice.proforma_invoice_number) {
            invoice.proforma_invoice_number = invoice.invoice_number;
        }

        invoice.invoice_number = invoice_number;
        invoice.series_key = series_key;
        invoice.invoice_type = 'client';
        invoice.converted_to_tax_at = new Date();
        pushEvent(invoice, 'converted_to_tax', created_by);
        const renderDoc = await this._enrichInvoiceForRender(invoice, actorUser);
        invoice.html_snapshot = renderInvoiceHtml(renderDoc);
        await invoice.save();

        this.generatePdf({ id: invoice._id, store: true, actorUser }).catch((err) => {
            console.error('Post-convert PDF generation failed:', err?.message || err);
        });

        return invoice;
    }

    async createPaymentLink({ id, actorUser }) {
        const invoice = await this._loadInvoiceForActor(id, actorUser);
        const lean = invoice.toObject();
        if (!['issued', 'sent', 'overdue'].includes(lean.status)) {
            this._throw('Payment link only for issued/sent/overdue invoices');
        }

        const buyer = lean.billing_snapshot?.buyer || {};
        const amountPaise = Math.round(Number(lean.balance_due || lean.total) * 100);
        if (amountPaise <= 0) this._throw('Invoice total must be greater than zero');

        const link = await razerPay.createPaymentLink({
            amount: amountPaise,
            description: `Invoice ${lean.invoice_number}`,
            customer: {
                name: buyer.billing_name || 'Customer',
                email: buyer.billing_email,
                contact: buyer.billing_phone,
            },
            notes: {
                invoice_id: String(lean._id),
                invoice_number: lean.invoice_number,
            },
        });

        invoice.payment_link_url = link.short_url;
        invoice.payment_link_id = link.id;
        invoice.events = invoice.events || [];
        invoice.events.push({ event: 'payment_link_created', at: new Date() });
        invoice.html_snapshot = renderInvoiceHtml(invoice.toObject());
        await invoice.save();
        return invoice;
    }

    async getSendPrefill({ id, adminEmail, actorUser }) {
        const invoice = await this.getById({ id, actorUser });
        const billingProfile = await manageBillingProfile.getOrCreate();
        const buyer = invoice.billing_snapshot?.buyer || {};

        const toCandidates = [];
        if (buyer.billing_email) toCandidates.push(buyer.billing_email);
        if (invoice.billingClientId) {
            const client = await BillingClient.findById(invoice.billingClientId).lean();
            if (client?.billing_email) toCandidates.push(client.billing_email);
        }

        const to = normalizeEmailList(toCandidates);
        const cc = normalizeEmailList([
            ...(billingProfile.invoice_email_cc || []),
            adminEmail,
        ]);
        const bcc = normalizeEmailList(billingProfile.invoice_email_bcc || []);
        const reply_to = billingProfile.invoice_reply_to
            || billingProfile.email
            || mail.source;

        return {
            invoice_id: invoice._id,
            invoice_number: invoice.invoice_number,
            status: invoice.status,
            suggested: {
                to,
                cc,
                bcc,
                reply_to,
                subject: buildDefaultInvoiceEmailSubject(invoice),
                message: '',
                attach_pdf: true,
                include_payment_link: true,
                pdf_url: invoice.pdf_url || null,
                client_name: buyer.billing_name || buyer.name || 'Customer',
            },
            email_deliveries: invoice.email_deliveries || [],
        };
    }

    async _persistEmailSendResult({ id, deliveryRecord, sent_by, success }) {
        const events = success
            ? [
                { event: 'sent', actor: sent_by, at: new Date() },
                {
                    event: 'email_sent',
                    actor: sent_by,
                    note: `to:${(deliveryRecord.to || []).join(',')}`,
                    at: new Date(),
                },
            ]
            : [{
                event: 'email_failed',
                actor: sent_by,
                note: deliveryRecord.error,
                at: new Date(),
            }];

        const update = {
            $push: {
                email_deliveries: deliveryRecord,
                events: { $each: events },
            },
        };

        if (success) {
            const htmlDoc = await this._enrichInvoiceForRender(await this.getById({ id }));
            update.$set = {
                status: 'sent',
                email_sent_at: new Date(),
                html_snapshot: renderInvoiceHtml(htmlDoc),
            };
        }

        const updated = await Invoice.findByIdAndUpdate(id, update, { new: true });
        if (!updated) this._throw('Invoice not found', 404);
        return updated;
    }

    async _dispatchInvoiceEmail({
        invoiceId,
        invoice,
        to,
        cc,
        bcc,
        reply_to,
        subject,
        message,
        attach_pdf,
        includePaymentLink,
    }) {
        const buyer = invoice.billing_snapshot?.buyer || {};
        const paymentLink = includePaymentLink ? (invoice.payment_link_url || '') : '';
        const htmlVariables = buildInvoiceEmailHtmlVariables({
            invoice,
            buyer,
            message,
            paymentLink,
        });
        const subjectVariables = {
            invoiceNumber: invoice.invoice_number,
            total: htmlVariables.total,
            dueDate: htmlVariables.dueDate,
        };

        const replyToList = reply_to ? [reply_to] : [];

        if (attach_pdf) {
            const pdfResult = await this.generatePdf({ id: invoiceId, store: true });
            const { html } = emailTemplates.getTemplate('invoice', htmlVariables, subjectVariables);

            return aws.sendMailWithAttachment({
                toEmails: to,
                ccAddresses: cc,
                bccAddresses: bcc,
                replyToAddresses: replyToList,
                subject,
                html,
                attachments: [{
                    filename: pdfResult.filename,
                    contentType: 'application/pdf',
                    content: pdfResult.buffer,
                }],
            });
        }

        return aws.sendMail({
            toEmails: to,
            ccAddresses: cc,
            bccAddresses: bcc,
            replyToAddresses: replyToList,
            templateName: 'invoice',
            htmlVariables,
            subjectVariables,
            customSubject: subject,
        });
    }

    async send({
        id,
        to,
        cc,
        bcc,
        reply_to,
        subject,
        message,
        attach_pdf = true,
        includePaymentLink = true,
        invoice_type,
        sent_by,
        actorUser,
    }) {
        let invoice = await this._loadInvoiceForActor(id, actorUser);

        if (invoice.status === 'draft') {
            await this.issue({ id, invoice_type, created_by: sent_by || null, actorUser });
            invoice = await this._loadInvoiceForActor(id, actorUser);
        }

        if (includePaymentLink && !invoice.payment_link_url) {
            await this.createPaymentLink({ id, actorUser });
            invoice = await this._loadInvoiceForActor(id, actorUser);
        }

        const buyer = invoice.billing_snapshot?.buyer || {};
        const billingProfile = await manageBillingProfile.getOrCreate();

        const fallbackTo = buyer.billing_email ? [buyer.billing_email] : [];
        const validated = validateInvoiceSendPayload({
            to: to?.length ? to : fallbackTo,
            cc: cc ?? billingProfile.invoice_email_cc,
            bcc: bcc ?? billingProfile.invoice_email_bcc,
            reply_to: reply_to
                ?? billingProfile.invoice_reply_to
                ?? billingProfile.email
                ?? mail.source,
        });

        if (!validated.ok) this._throw(validated.message);

        const emailSubject = (subject && String(subject).trim())
            || buildDefaultInvoiceEmailSubject(invoice);
        const emailMessage = message != null ? String(message) : '';

        const deliveryRecord = {
            sent_at: new Date(),
            sent_by: sent_by || undefined,
            to: validated.to,
            cc: validated.cc,
            bcc: validated.bcc,
            reply_to: validated.reply_to,
            subject: emailSubject,
            message: emailMessage,
            attach_pdf: !!attach_pdf,
            include_payment_link: !!includePaymentLink,
            status: 'sent',
        };

        try {
            const sesResult = await this._dispatchInvoiceEmail({
                invoiceId: id,
                invoice: invoice.toObject(),
                to: validated.to,
                cc: validated.cc,
                bcc: validated.bcc,
                reply_to: validated.reply_to,
                subject: emailSubject,
                message: emailMessage,
                attach_pdf: !!attach_pdf,
                includePaymentLink: !!includePaymentLink,
            });
            deliveryRecord.ses_message_id = sesResult?.MessageId;
        } catch (err) {
            deliveryRecord.status = 'failed';
            deliveryRecord.error = err?.message || String(err);
            await this._persistEmailSendResult({
                id,
                deliveryRecord,
                sent_by,
                success: false,
            });
            this._throw(`Failed to send invoice email: ${deliveryRecord.error}`, 502);
        }

        const updated = await this._persistEmailSendResult({
            id,
            deliveryRecord,
            sent_by,
            success: true,
        });

        if (!attach_pdf) {
            this.generatePdf({ id, store: true }).catch((err) => {
                console.error('Post-send PDF generation failed:', err?.message || err);
            });
        }

        return updated;
    }

    async markPaid({ id, razorpay_payment_id, amount_paid, issue_tax_invoice_on_payment = false, actorUser }) {
        let invoice = await this._loadInvoiceForActor(id, actorUser);

        invoice.status = 'paid';
        invoice.paid_at = new Date();
        invoice.amount_paid = amount_paid != null ? Number(amount_paid) : invoice.total;
        invoice.balance_due = 0;
        if (razorpay_payment_id) invoice.razorpay_payment_id = razorpay_payment_id;
        pushEvent(invoice, 'paid');

        await invoice.save();

        if (issue_tax_invoice_on_payment && invoice.invoice_type === 'proforma') {
            invoice = await this.convertToTaxInvoice({ id: invoice._id, actorUser });
        }

        if (invoice.customerId) {
            await Customer.findByIdAndUpdate(invoice.customerId, {
                $set: { payment_status: 'Paid' },
            });
        }

        return invoice;
    }

    async cancel({ id, actorUser }) {
        const invoice = await this._loadInvoiceForActor(id, actorUser);
        if (invoice.status === 'paid') this._throw('Paid invoices cannot be cancelled');
        invoice.status = 'cancelled';
        pushEvent(invoice, 'cancelled');
        await invoice.save();
        return invoice;
    }

    async list({
        customerId,
        billingClientId,
        status,
        space_type,
        source,
        limit = 20,
        skip = 0,
        startDate,
        endDate,
        actorUser,
    } = {}) {
        let condition = {};
        if (customerId) condition.customerId = customerId;
        if (billingClientId) condition.billingClientId = billingClientId;
        if (status) condition.status = status;
        if (space_type) condition.space_type = space_type;
        if (source) condition.source = source;
        if (startDate || endDate) {
            condition.added_on = {};
            if (startDate) condition.added_on.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                condition.added_on.$lte = end;
            }
        }

        condition = applyCreatedByScope(condition, actorUser);

        const [data, count] = await Promise.all([
            Invoice.find(condition).sort({ added_on: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
            Invoice.countDocuments(condition),
        ]);
        return { data, count };
    }

    async getById({ id, actorUser }) {
        if (!id || !ObjectId.isValid(id)) this._throw('Invalid id');
        const doc = await Invoice.findById(id).lean();
        if (!doc) this._throw('Invoice not found', 404);
        assertBillingRecordAccess(doc, actorUser);
        return doc;
    }

    async getHtml({ id, print = false, actorUser }) {
        const doc = await this._enrichInvoiceForRender(await this.getById({ id, actorUser }), actorUser);
        const html = print
            ? renderInvoicePrintHtml(doc)
            : renderInvoiceHtml(doc);
        return {
            html,
            invoice_number: doc.invoice_number,
            filename: invoicePdfFilename(doc),
        };
    }

    async _uploadPdfBuffer(invoiceId, buffer) {
        const bucket = process.env.AWS_S3_BUCKET || 'cofynd-staging';
        const key = `${storage.s3.path.document}/invoices/${invoiceId}.pdf`;
        const uploaded = await aws.S3Upload({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: 'application/pdf',
        });
        return uploaded?.Location || null;
    }

    async generatePdf({ id, store = true, actorUser }) {
        const invoice = await this._loadInvoiceForActor(id, actorUser);

        if (invoice.status === 'draft') {
            await this._syncBillingClientSnapshot(invoice, actorUser);
        }

        const fresh = await this._enrichInvoiceForRender(invoice, actorUser);
        fresh.html_snapshot = renderInvoiceHtml(fresh);
        const buffer = await generateInvoicePdfBuffer(fresh);
        const filename = invoicePdfFilename(fresh);

        let pdf_url = invoice.pdf_url;
        if (store) {
            try {
                pdf_url = await this._uploadPdfBuffer(id, buffer);
                invoice.pdf_url = pdf_url;
                invoice.html_snapshot = fresh.html_snapshot;
                if (invoice.status === 'draft' && fresh.billing_snapshot) {
                    invoice.billing_snapshot = fresh.billing_snapshot;
                    invoice.markModified('billing_snapshot');
                }
                invoice.events = invoice.events || [];
                invoice.events.push({ event: 'updated', at: new Date(), note: 'pdf_generated' });
                await invoice.save();
            } catch (err) {
                console.error('Invoice PDF S3 upload failed:', err?.message || err);
            }
        }

        return { buffer, filename, pdf_url, invoice: fresh };
    }

    async getPdf({ id, regenerate = false, actorUser }) {
        const invoice = await this.getById({ id, actorUser });
        if (!regenerate && invoice.pdf_url) {
            return {
                buffer: null,
                pdf_url: invoice.pdf_url,
                filename: invoicePdfFilename(invoice),
                from_cache: true,
            };
        }
        const result = await this.generatePdf({ id, store: true, actorUser });
        return {
            buffer: result.buffer,
            pdf_url: result.pdf_url,
            filename: result.filename,
            from_cache: false,
        };
    }

    async getPreview({ id, actorUser }) {
        const invoice = await this._enrichInvoiceForRender(await this.getById({ id, actorUser }), actorUser);
        const html = renderInvoiceHtml(invoice);
        const print_html = renderInvoicePrintHtml(invoice);
        const filename = invoicePdfFilename(invoice);

        return {
            invoice: {
                _id: invoice._id,
                invoice_number: invoice.invoice_number,
                invoice_type: invoice.invoice_type,
                status: invoice.status,
                total: invoice.total,
                space_type: invoice.space_type,
            },
            html,
            print_html,
            pdf_url: invoice.pdf_url || null,
            filename,
        };
    }
}

export default new ManageInvoiceService();
