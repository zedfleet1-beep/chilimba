/**
 * Group reports. /api/v1/groups/:id/reports/*
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireGroupRole } from '@/middleware/requireGroupRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import { cycleReportQuerySchema, memberStatementQuerySchema } from './reports.validators';
import {
  getCycleSummary,
  getMemberStatement,
  getOutstandingContributions,
  getLoanBook,
  getPayoutLedger,
} from './reports.service';
import { buildPayoutLedgerPdf } from './payoutLedgerPdf';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get(
  '/cycle-summary',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const query = parseBody(cycleReportQuerySchema, req.query);
    const summary = await getCycleSummary(req.params.id, query.cycleId);
    res.json({ success: true, data: summary });
  }),
);

router.get(
  '/member-statement',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const query = parseBody(memberStatementQuerySchema, req.query);
    const statement = await getMemberStatement(req.params.id, query.memberId, query.cycleId);
    res.json({ success: true, data: statement });
  }),
);

router.get(
  '/outstanding',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const query = parseBody(cycleReportQuerySchema, req.query);
    const outstanding = await getOutstandingContributions(req.params.id, query.cycleId);
    res.json({ success: true, data: outstanding });
  }),
);

router.get(
  '/loan-book',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const book = await getLoanBook(req.params.id);
    res.json({ success: true, data: book });
  }),
);

router.get(
  '/payout-ledger',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const query = parseBody(cycleReportQuerySchema, req.query);
    const ledger = await getPayoutLedger(req.params.id, query.cycleId);
    res.json({ success: true, data: ledger });
  }),
);

router.get(
  '/payout-ledger.pdf',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const query = parseBody(cycleReportQuerySchema, req.query);
    const ledger = await getPayoutLedger(req.params.id, query.cycleId);
    const pdf = await buildPayoutLedgerPdf(ledger);
    const filename = `payout-ledger-${ledger.group.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }),
);

export default router;