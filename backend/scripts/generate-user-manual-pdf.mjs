/**
 * Generate docs/user-manual.pdf and frontend/public/user-manual.pdf
 * Run: npm run docs:user-manual-pdf
 */
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const sections = [
  {
    title: 'Chilimba User Guide',
    subtitle: 'What each button does and what to expect — Phase 1 (2026)',
    body: null,
  },
  {
    title: 'Sign in & sign up',
    body: [
      'Send verification code → OTP screen (sign up).',
      '6 OTP digits → auto-submits; success → Dashboard.',
      'Sign in → Dashboard or the page you tried to open.',
      'Moon/Sun icon → light or dark mode.',
    ],
  },
  {
    title: 'Dashboard & menu',
    body: [
      'My invoices card → subscription invoices list.',
      'My group card → group detail page.',
      'Cycles / Reports cards → shortcuts (when you have a group).',
      'Sign out → login screen.',
    ],
  },
  {
    title: 'Invoices',
    body: [
      'Copy → copies pay-to account number.',
      'Upload → sends proof-of-payment; wait for admin approval.',
      'After approval → WhatsApp create-group link.',
      'Create group → Sign in → your new group.',
    ],
  },
  {
    title: 'My group',
    body: [
      'Cycles / Reports / Loans → section pages.',
      'Settings → owner only.',
      'Add member → new member + WhatsApp invite.',
      'Remove → owner only; confirm dialog.',
    ],
  },
  {
    title: 'Group settings (owner)',
    body: [
      'Save changes → “Settings saved” or validation error.',
      'Refresh groups → list WhatsApp groups (add Chilimba number first).',
      'Send verification code → code posted in WhatsApp group.',
      'Verify & link group → announcements enabled.',
      'Disconnect → unlinks WhatsApp group.',
    ],
  },
  {
    title: 'Cycles — buttons',
    body: [
      'Open cycle → creates months (owner).',
      'Start → collections begin (owner).',
      'Complete → ends cycle early (owner).',
      'POP → upload payment proof.',
      'Record → mark paid in cash (owner/treasurer).',
      'Approve POP → approve uploaded proof.',
      'Pick recipients → manual payout mode (owner).',
      'Record payout → mark sent; optional receipt.',
    ],
  },
  {
    title: 'Reports & loans',
    body: [
      'Tabs: Cycle summary, Outstanding, Member statements, Loan book, Payout ledger.',
      'Download PDF → payout ledger export.',
      'Request loan / Approve / Reject / Record repayment.',
    ],
  },
  {
    title: 'User stories',
    body: [
      'New owner: Sign up → pay invoice → Upload POP → Create group → Settings → Open cycle → Start.',
      'Treasurer: Approve POP or Record cash → Record payout.',
      'Member: POP on your row → check Member statements.',
    ],
  },
  {
    title: 'Troubleshooting',
    body: [
      'Logged out → sign in again; session saves per device.',
      '“Not a member” → Dashboard → My group.',
      'No Settings → owner only.',
      'Refresh groups empty → add Chilimba number to WhatsApp, wait, refresh.',
      'Record payout disabled → pick recipients and record contributions first.',
    ],
  },
];

function buildPdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const section of sections) {
      if (doc.y > 680) doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a').text(section.title);
      if (section.subtitle) {
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').fillColor('#555').text(section.subtitle);
      }
      doc.moveDown(0.6);
      if (section.body) {
        doc.fontSize(10).font('Helvetica').fillColor('#333');
        for (const line of section.body) {
          doc.text(`•  ${line}`, { indent: 10, lineGap: 4 });
        }
      }
      doc.moveDown(1);
    }

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#888').text('Full guide: docs/user-manual.md', { align: 'center' });
    doc.end();
  });
}

const pdf = await buildPdf();
const outPaths = [
  path.join(root, 'docs', 'user-manual.pdf'),
  path.join(root, 'frontend', 'public', 'user-manual.pdf'),
];
for (const p of outPaths) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, pdf);
  console.log('Wrote', p);
}