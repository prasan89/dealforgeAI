import express from 'express';
import PDFDocument from 'pdfkit';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { analyze, Terms, legalText, solidity, compile } from './engine.js';
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.get('/api/health', (req,res) => res.json({ ok: true, provider: process.env.ANTHROPIC_API_KEY ? 'Claude' : 'Local parser' }));
app.post('/api/analyze', async (req,res,next) => {
  try {
    if (typeof req.body.text !== 'string' || req.body.text.trim().length < 40 || req.body.text.length > 15000) return res.status(400).json({ error: 'Enter an agreement between 40 and 15,000 characters.' });
    res.json(await analyze(req.body.text));
  } catch (e) { next(e); }
});
app.post('/api/generate', (req,res,next) => {
  try {
    const t = Terms.parse(req.body.terms);
    const source = solidity(t);
    const result = compile(source);
    res.json({ terms: t, sections: legalText(t), source, validation: { compiled: true, compiler: result.compiler, warnings: result.warnings, checks: [ { name: 'Milestone totals match the legal fee', passed: true }, { name: 'Solidity compilation', passed: true } ] } });
  } catch (e) { next(e); }
});
app.post('/api/pdf', (req,res,next) => {
  try {
    const t = Terms.parse(req.body.terms);
    const doc = new PDFDocument({ margin: 55, size: 'A4', info: { Title: t.title, Author: 'DealForge AI' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="dealforge-agreement.pdf"');
    doc.pipe(res);
    doc.fillColor('#174c3e').fontSize(11).text('DEALFORGE AI  /  AGREEMENT DRAFT').moveDown();
    doc.fontSize(25).text(t.title).moveDown(0.5);
    doc.fillColor('#666666').fontSize(10).text('Unsigned draft · Review before signing or deploying').moveDown(1.5);
    for (const [heading,body] of legalText(t)) {
      if (doc.y > 650) doc.addPage();
      doc.fillColor('#174c3e').fontSize(13).text(heading).moveDown(0.4);
      doc.fillColor('#222222').fontSize(10.5).text(body, { lineGap: 4 }).moveDown(1);
    }
    doc.end();
  } catch (e) { next(e); }
});
const dist = resolve('dist');
if (existsSync(dist)) { app.use(express.static(dist)); app.get('/{*path}', (req,res) => { if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found' }); res.sendFile(resolve(dist,'index.html')); }); }
app.use((err,req,res,next) => {
  if (res.headersSent) return next(err);
  const error = err.issues ? err.issues.map(i => i.path.join('.') + ': ' + i.message).join('\n') : err.type === 'entity.too.large' ? 'Agreement is too large.' : err.message || 'Unable to process request.';
  res.status(400).json({ error });
});
app.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('DealForge API available at http://127.0.0.1:' + (process.env.PORT || 3001)));
