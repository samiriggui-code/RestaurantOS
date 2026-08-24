import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { displayName } from '../lib/locale';
import { formatEUR } from '../lib/money';
import { parseBusinessSettings } from '../lib/business-settings';
import { sendInvoiceEmail } from '../lib/mail-service';
import { computeLineTotals, invoiceTotalsFromOrder, orderPriceMode } from '../lib/invoice-vat';
import {
  createInvoiceFromOrder,
  clientAddressFromOrder,
  invoiceMissingFields,
  orderLinesToInvoiceLines,
  allocateInvoiceNumber,
} from '../lib/invoice-from-order';
import { buildFacturXCiiXml } from '../lib/factur-x-cii';
import { renderInvoiceDocumentHtml } from '../lib/invoice-document-service';

const router = Router();

// ——— Facture commande (routes statiques avant /:id) ———

router.get('/orders/:id/print', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: { items: { include: { menuItem: true } }, table: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const business = await prisma.business.findUnique({ where: { id: order.businessId } });
    const settings = parseBusinessSettings(business?.settings);
    const businessName = displayName(business) || 'Restaurant';

    let print = '';
    print += `${'='.repeat(32)}\n`;
    print += `  ${businessName}\n`;
    if (settings.siret) print += `  SIRET ${settings.siret}\n`;
    print += `${'='.repeat(32)}\n`;
    print += `Commande #${order.orderNumber}\n`;
    print += `Date: ${new Date(order.createdAt).toLocaleDateString('fr-FR')}\n`;
    if (order.table) print += `Table: ${order.table.number}\n`;
    print += `${'-'.repeat(32)}\n`;

    for (const item of order.items) {
      const name = displayName(item.menuItem);
      print += `${name}\n`;
      print += `  x${item.quantity} @ ${formatEUR(item.price)}\n`;
      print += `  ${formatEUR(item.price * item.quantity)}\n`;
    }

    print += `${'-'.repeat(32)}\n`;
    print += `Sous-total:  ${formatEUR(order.subtotal)}\n`;
    print += `TVA:         ${formatEUR(order.tax)}\n`;
    if (order.serviceCharge > 0) print += `Service:     ${formatEUR(order.serviceCharge)}\n`;
    print += `${'='.repeat(32)}\n`;
    print += `TOTAL:       ${formatEUR(order.total)}\n`;
    print += `Statut:      ${order.paymentStatus === 'PAID' ? 'Payé' : 'Non payé'}\n`;
    print += `${'='.repeat(32)}\n`;
    print += `\nMerci — ${businessName}\n`;

    res.type('text/plain; charset=utf-8').send(print);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/orders/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const business = await prisma.business.findUnique({ where: { id: order.businessId } });
    const settings = parseBusinessSettings(business?.settings);

    res.json({
      header: {
        businessName: displayName(business) || 'Restaurant',
        businessLogo: business?.logo || null,
        taxNumber: settings.vatNumber ?? '',
        siret: settings.siret ?? '',
        address: settings.address ?? '',
        phone: settings.phone ?? '',
      },
      order: {
        number: order.orderNumber,
        date: order.createdAt,
        type: order.type,
        status: order.status,
        table: order.table?.number || null,
        cashier: order.cashier?.name || null,
      },
      items: order.items.map(item => ({
        name: displayName(item.menuItem),
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        modifiers: item.selectedModifiers || {},
      })),
      summary: {
        subtotal: order.subtotal,
        tax: order.tax,
        serviceCharge: order.serviceCharge,
        discount: order.discount,
        total: order.total,
        paid: order.paymentStatus === 'PAID' ? order.total : 0,
        due: order.paymentStatus === 'PAID' ? 0 : order.total,
      },
      payment: { method: order.paymentMethod || null, status: order.paymentStatus },
      footer: { thankYou: 'Merci de votre commande' },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ——— Factures CRM ———

router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const invoices = await prisma.invoice.findMany({
        where: { businessId: req.user!.businessId },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          order: { select: { orderNumber: true } },
        },
        orderBy: { issueDate: 'desc' },
        take: 100,
      });
      res.json(
        invoices.map(inv => ({
          ...inv,
          missingFields: invoiceMissingFields(inv),
        }))
      );
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get(
  '/order-sources',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const businessId = req.user!.businessId;
      const q = String(req.query.q ?? '').trim();

      const where: {
        businessId: string;
        paymentStatus: string;
        status: { not: string };
        OR?: Array<Record<string, unknown>>;
      } = {
        businessId,
        paymentStatus: 'PAID',
        status: { not: 'CANCELLED' },
      };

      if (q) {
        const num = parseInt(q, 10);
        where.OR = [
          ...(Number.isFinite(num) ? [{ orderNumber: num }] : []),
          { customerName: { contains: q, mode: 'insensitive' } },
          { customerPhone: { contains: q } },
          { customerEmail: { contains: q, mode: 'insensitive' } },
        ];
      }

      const orders = await prisma.order.findMany({
        where: where as never,
        include: { items: { include: { menuItem: true } } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      });

      const orderIds = orders.map(o => o.id);
      const linked = orderIds.length
        ? await prisma.invoice.findMany({
            where: { businessId, orderId: { in: orderIds } },
            select: { id: true, orderId: true, invoiceNumber: true, status: true },
          })
        : [];
      const byOrder = new Map(linked.map(i => [i.orderId!, i]));

      const business = await prisma.business.findUnique({ where: { id: businessId } });
      const taxRate = business?.taxRate ?? 10;

      res.json(
        orders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          total: order.total,
          createdAt: order.createdAt,
          isOnlineOrder: order.isOnlineOrder,
          type: order.type,
          clientAddress: clientAddressFromOrder(order),
          invoice: byOrder.get(order.id) ?? null,
          lines: orderLinesToInvoiceLines(order, taxRate).map(
            ({ description, quantity, unitPriceCents, taxRate: tr }) => ({
              description,
              quantity,
              unitPriceCents,
              taxRate: tr,
            })
          ),
          vat: invoiceTotalsFromOrder(order, orderLinesToInvoiceLines(order, taxRate)),
          priceMode: orderPriceMode(order),
        }))
      );
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post(
  '/from-order/:orderId',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const result = await createInvoiceFromOrder(
        prisma,
        req.user!.businessId,
        req.params.orderId,
        {
          createdById: req.user!.userId,
          type: 'FROM_ORDER',
        }
      );
      if (!result) return res.status(404).json({ error: 'Commande introuvable ou non payée' });
      res.status(result.created ? 201 : 200).json({
        ...result.invoice,
        _existing: !result.created,
        missingFields: invoiceMissingFields(result.invoice),
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const businessId = req.user!.businessId;
      const body = req.body;

      if (!body.clientName?.trim())
        return res.status(400).json({ error: 'Nom client obligatoire' });
      if (!Array.isArray(body.lines) || !body.lines.length) {
        return res.status(400).json({ error: 'Au moins une ligne de facture requise' });
      }

      const normalizedLines = body.lines.map((l: Record<string, unknown>, i: number) => ({
        description: String(l.description ?? '').trim(),
        quantity: Number(l.quantity) || 1,
        unitPriceCents: Math.round(Number(l.unitPriceCents) || 0),
        taxRate: Number(l.taxRate) ?? 10,
        sortOrder: i,
      }));

      type InvoiceLineInput = (typeof normalizedLines)[number];

      if (normalizedLines.some((line: InvoiceLineInput) => !line.description)) {
        return res.status(400).json({ error: 'Description ligne obligatoire' });
      }

      const totals = computeLineTotals(normalizedLines);

      const invoice = await prisma.$transaction(async tx => {
        const invoiceNumber = await allocateInvoiceNumber(tx, businessId);
        return tx.invoice.create({
          data: {
            businessId,
            invoiceNumber,
            status: body.status === 'ISSUED' ? 'ISSUED' : 'DRAFT',
            type: body.type ?? 'ON_DEMAND',
            orderId: body.orderId || null,
            clientName: body.clientName.trim(),
            clientEmail: body.clientEmail?.trim() || null,
            clientPhone: body.clientPhone?.trim() || null,
            clientSiret: body.clientSiret?.trim() || null,
            clientVatNumber: body.clientVatNumber?.trim() || null,
            clientAddress: body.clientAddress?.trim() || null,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            notes: body.notes?.trim() || null,
            subtotalCents: totals.subtotalCents,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
            createdById: req.user!.userId,
            lines: { create: normalizedLines },
          },
          include: { lines: true },
        });
      });

      res.status(201).json(invoice);
    } catch (error) {
      console.error('Create invoice:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get(
  '/:id/print',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const invoice = await prisma.invoice.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          order: { select: { orderNumber: true } },
        },
      });
      if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });

      const html = await renderInvoiceDocumentHtml(prisma, req.user!.businessId, invoice);

      res.type('text/html; charset=utf-8').send(html);
    } catch (error) {
      console.error('Invoice print:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get(
  '/:id/factur-x',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const invoice = await prisma.invoice.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });

      const business = await prisma.business.findUnique({ where: { id: invoice.businessId } });
      const settings = parseBusinessSettings(business?.settings);

      const xml = buildFacturXCiiXml({
        businessName: displayName(business) || 'Restaurant',
        siret: settings.siret,
        vatNumber: settings.vatNumber,
        address: settings.address,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        clientName: invoice.clientName,
        clientSiret: invoice.clientSiret,
        clientVatNumber: invoice.clientVatNumber,
        clientAddress: invoice.clientAddress,
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        totalCents: invoice.totalCents,
        lines: invoice.lines,
      });

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { eInvoiceFormat: 'FACTUR-X_MINIMUM' },
      });

      res
        .type('application/xml; charset=utf-8')
        .set(
          'Content-Disposition',
          `attachment; filename="facture-${invoice.invoiceNumber}-factur-x.xml"`
        )
        .send(xml);
    } catch (error) {
      console.error('Invoice factur-x:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const invoice = await prisma.invoice.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
        include: { lines: { orderBy: { sortOrder: 'asc' } }, order: true },
      });
      if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });
      res.json({ ...invoice, missingFields: invoiceMissingFields(invoice) });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const businessId = req.user!.businessId;
      const existing = await prisma.invoice.findFirst({
        where: { id: req.params.id, businessId },
        include: { lines: true },
      });
      if (!existing) return res.status(404).json({ error: 'Facture introuvable' });

      const body = req.body as {
        clientName?: string;
        clientEmail?: string;
        clientPhone?: string;
        clientSiret?: string;
        clientVatNumber?: string;
        clientAddress?: string;
        notes?: string;
        status?: string;
        lines?: Array<{
          description: string;
          quantity: number;
          unitPriceCents: number;
          taxRate?: number;
        }>;
      };

      let subtotalCents = existing.subtotalCents;
      let taxCents = existing.taxCents;
      let totalCents = existing.totalCents;

      const updated = await prisma.$transaction(async tx => {
        if (Array.isArray(body.lines) && body.lines.length) {
          const normalizedLines = body.lines.map((l, i) => ({
            description: String(l.description ?? '').trim(),
            quantity: Number(l.quantity) || 1,
            unitPriceCents: Math.round(Number(l.unitPriceCents) || 0),
            taxRate: Number(l.taxRate) ?? 10,
            sortOrder: i,
          }));
          if (normalizedLines.some(l => !l.description)) {
            throw Object.assign(new Error('Description ligne obligatoire'), { status: 400 });
          }
          const totals = computeLineTotals(normalizedLines);
          subtotalCents = totals.subtotalCents;
          taxCents = totals.taxCents;
          totalCents = totals.totalCents;
          await tx.invoiceLine.deleteMany({ where: { invoiceId: existing.id } });
          await tx.invoiceLine.createMany({
            data: normalizedLines.map(l => ({ ...l, invoiceId: existing.id })),
          });
        }

        const clientName = body.clientName?.trim() ?? existing.clientName;
        const clientEmail =
          body.clientEmail !== undefined ? body.clientEmail?.trim() || null : existing.clientEmail;
        const clientPhone =
          body.clientPhone !== undefined ? body.clientPhone?.trim() || null : existing.clientPhone;
        const clientSiret =
          body.clientSiret !== undefined ? body.clientSiret?.trim() || null : existing.clientSiret;
        const clientVatNumber =
          body.clientVatNumber !== undefined
            ? body.clientVatNumber?.trim() || null
            : existing.clientVatNumber;
        const clientAddress =
          body.clientAddress !== undefined
            ? body.clientAddress?.trim() || null
            : existing.clientAddress;
        const notes = body.notes !== undefined ? body.notes?.trim() || null : existing.notes;

        let status = body.status ?? existing.status;
        const missing = invoiceMissingFields({
          clientName,
          clientEmail,
          status,
        });
        if (status === 'ISSUED' && missing.length > 0 && body.status === 'ISSUED') {
          throw Object.assign(new Error(`Informations manquantes : ${missing.join(', ')}`), {
            status: 400,
          });
        }
        if (status === 'DRAFT' && body.status === 'ISSUED' && missing.length === 0) {
          status = 'ISSUED';
        }

        return tx.invoice.update({
          where: { id: existing.id },
          data: {
            clientName,
            clientEmail,
            clientPhone,
            clientSiret,
            clientVatNumber,
            clientAddress,
            notes,
            status,
            subtotalCents,
            taxCents,
            totalCents,
          },
          include: {
            lines: { orderBy: { sortOrder: 'asc' } },
            order: { select: { orderNumber: true } },
          },
        });
      });

      res.json({ ...updated, missingFields: invoiceMissingFields(updated) });
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    }
  }
);

router.post(
  '/:id/send',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const invoice = await prisma.invoice.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!invoice) return res.status(404).json({ error: 'Facture introuvable' });

      const to = (req.body.email as string)?.trim() || invoice.clientEmail;
      if (!to) return res.status(400).json({ error: 'Email destinataire requis' });

      const sent = await sendInvoiceEmail(prisma, invoice.businessId, to, {
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        issueDate: new Date(invoice.issueDate).toLocaleDateString('fr-FR'),
        dueDate: invoice.dueDate
          ? new Date(invoice.dueDate).toLocaleDateString('fr-FR')
          : undefined,
        lines: invoice.lines.map(l => ({
          description: l.description,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          taxRate: l.taxRate,
          lineTotalCents: Math.round(l.quantity * l.unitPriceCents),
        })),
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        totalCents: invoice.totalCents,
        notes: invoice.notes ?? undefined,
      });

      if (!sent) return res.status(502).json({ error: 'Envoi email échoué — vérifiez EMAIL_*' });

      const updated = await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'SENT', sentAt: new Date(), clientEmail: to },
        include: { lines: true },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
