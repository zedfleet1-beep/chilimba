import PDFDocument from 'pdfkit';
import { PayoutLedgerResult } from './reports.service';

export function buildPayoutLedgerPdf(ledger: PayoutLedgerResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Payout Ledger', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(ledger.group.name, { align: 'center' });
    if (ledger.cycle) {
      doc.fontSize(10).fillColor('#555').text(`Cycle #${ledger.cycle.cycleNumber} · ${ledger.cycle.status}`, { align: 'center' });
    }
    doc.moveDown(1.5);
    doc.fillColor('#000');

    const colX = { month: 50, recipients: 180, amount: 360, status: 470 };
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Month', colX.month, doc.y);
    doc.text('Recipients', colX.recipients, doc.y - 12);
    doc.text('Amount', colX.amount, doc.y - 12);
    doc.text('Status', colX.status, doc.y - 12);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica');

    for (const row of ledger.rows) {
      const y = doc.y;
      if (y > 720) {
        doc.addPage();
      }
      doc.fontSize(9).text(row.monthLabel, colX.month, doc.y, { width: 120 });
      const recipientY = doc.y;
      doc.text(row.recipients.join(', ') || '—', colX.recipients, y, { width: 170 });
      doc.text(row.amountLabel, colX.amount, y);
      doc.text(row.status, colX.status, y);
      doc.y = Math.max(recipientY, y) + 14;
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888').text(`Generated ${new Date().toISOString().slice(0, 10)} by Chilimba`, { align: 'center' });
    doc.end();
  });
}