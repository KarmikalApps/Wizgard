import Busboy from 'busboy';
import sharp from 'sharp';
import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

export const attachmentLimits = { files: 10, fileBytes: 20 * 1024 * 1024, totalBytes: 100 * 1024 * 1024 };
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const textExtensions = new Set(['.txt','.md','.csv','.json','.log','.js','.jsx','.ts','.tsx','.py','.html','.css','.xml','.yaml','.yml','.sql','.sh','.ini']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export function validateAttachmentIds(ids = []) {
  if (!Array.isArray(ids) || ids.length > 10 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !idPattern.test(id))) throw fail('Attach up to 10 different files.');
  return ids;
}
export async function loadAttachments(data, ids) {
  return Promise.all(validateAttachmentIds(ids).map(async id => {
    try { return JSON.parse(await readFile(join(data, 'attachments', id, 'metadata.json'), 'utf8')); }
    catch { throw fail('An attachment is no longer available. Please attach it again.'); }
  }));
}
export function attachmentImagePath(data, file) { return join(data, 'attachments', file.id, 'image.png'); }
export async function receiveAttachments(req, data) {
  const uploads = [];
  await new Promise((resolve, reject) => {
    let bus, failure, total = 0;
    try { bus = Busboy({ headers: req.headers, limits: { files: 10, fileSize: attachmentLimits.fileBytes, fields: 0, parts: 11 } }); }
    catch { reject(fail('Expected a file upload.')); return; }
    const rejectLimit = () => { failure = fail('Upload at most 10 files, 20 MB per file and 100 MB per batch.', 413); };
    bus.on('file', (_, stream, info) => {
      const chunks = []; let bytes = 0;
      stream.on('limit', rejectLimit);
      stream.on('data', chunk => { total += chunk.length; bytes += chunk.length; if (total > attachmentLimits.totalBytes) rejectLimit(); if (!failure) chunks.push(chunk); });
      stream.on('end', () => { if (!failure) uploads.push({ name: basename(info.filename.replaceAll('\\', '/')).slice(0, 180), buffer: Buffer.concat(chunks), bytes }); });
    });
    for (const name of ['filesLimit','partsLimit','fieldsLimit']) bus.on(name, rejectLimit);
    bus.on('error', () => reject(fail('Incomplete file upload.')));
    req.on('aborted', () => { bus.destroy(); reject(fail('Upload cancelled.')); });
    bus.on('close', () => failure ? reject(failure) : resolve()); req.pipe(bus);
  });
  if (!uploads.length) throw fail('Choose at least one file.');
  const created = [], result = [];
  try {
    for (const upload of uploads) {
      const { name, buffer, bytes } = upload, ext = extname(name).toLowerCase();
      if (!bytes) throw fail(name + ' is empty.');
      const id = randomUUID(), folder = join(data, 'attachments', id);
      await mkdir(folder, { recursive: true }); created.push(folder);
      const file = { id, name, bytes, kind: 'document', url: '/attachments/' + id + '/original', createdAt: new Date().toISOString() };
      let text = '';
      if (['.png','.jpg','.jpeg','.webp'].includes(ext)) {
        const source = sharp(buffer, { limitInputPixels: 40_000_000, animated: false });
        const meta = await source.metadata();
        if (!['png','jpeg','webp'].includes(meta.format)) throw fail('Unsupported image data in ' + name);
        await source.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).png().toFile(join(folder, 'image.png'));
        Object.assign(file, { kind: 'image', width: meta.width, height: meta.height, previewUrl: '/attachments/' + id + '/image.png' });
      } else if (ext === '.pdf') {
        const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true });
        const pdf = await task.promise;
        try {
          file.pages = pdf.numPages;
          for (let i = 1; i <= Math.min(pdf.numPages, 500) && text.length < 500000; i++) {
            const page = await pdf.getPage(i), content = await page.getTextContent();
            text += '\n[Page ' + i + ']\n' + content.items.map(item => item.str || '').join(' ') + '\n';
            page.cleanup();
          }
          if (pdf.numPages > 500 || text.length >= 500000) file.warning = 'Extraction limited to 500 pages / 500,000 characters.';
          if (text.replace(/\[Page \d+\]/g, '').trim().length < 20) file.warning = 'This PDF has little or no extractable text. Attach screenshots of its pages for visual analysis; OCR is not included.';
        } finally { await task.destroy(); }
      } else if (ext === '.docx') {
        text = (await mammoth.extractRawText({ buffer })).value;
      } else if (textExtensions.has(ext)) {
        if (buffer.includes(0)) throw fail(name + ' appears to be a binary file.');
        text = buffer.toString('utf8');
      } else throw fail('Unsupported file: ' + name + '. Use PDF, DOCX, text/code, PNG, JPEG or WebP.');
      if (text.length > 500000) file.warning = 'Extraction limited to the first 500,000 characters.';
      await writeFile(join(folder, 'original'), buffer);
      if (file.kind === 'document') await writeFile(join(folder, 'text.txt'), text.slice(0, 500000));
      await writeFile(join(folder, 'metadata.json'), JSON.stringify(file)); result.push(file);
    }
    return result;
  } catch (error) {
    await Promise.all(created.map(folder => rm(folder, { recursive: true, force: true })));
    throw fail(error.message, error.status || 400);
  }
}
export function selectExcerpts(text, question, budget) {
  if (text.length <= budget) return text;
  const terms = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])];
  const chunks = []; for (let i = 0; i < text.length; i += 1800) chunks.push({ offset: i, text: text.slice(i, i + 1800) });
  const ranked = chunks.map(c => ({ ...c, score: terms.reduce((n, term) => n + (c.text.toLowerCase().includes(term) ? 1 : 0), 0) }));
  ranked[0].score += 0.5;
  const chosen = ranked.sort((a,b) => b.score - a.score).slice(0, Math.max(1, Math.floor(budget / 1900))).sort((a,b) => a.offset - b.offset);
  return '[Selected excerpts; the full document does not fit in this turn.]\n' + chosen.map(c => '[Character ' + c.offset + ']\n' + c.text).join('\n…\n').slice(0, budget);
}
export async function attachmentContext(data, files, question) {
  const documents = files.filter(f => f.kind === 'document'), images = files.filter(f => f.kind === 'image');
  const parts = [];
  for (const f of documents) {
    const text = await readFile(join(data, 'attachments', f.id, 'text.txt'), 'utf8');
    parts.push('FILE ' + JSON.stringify(f.name) + (f.warning ? '\nWarning: ' + f.warning : '') + '\n' + selectExcerpts(text, question, Math.floor(22000 / Math.max(documents.length, 1))));
  }
  return { text: parts.length ? '\n\n<attached_documents>\n' + parts.join('\n\n') + '\n</attached_documents>' : '',
    images: await Promise.all(images.map(async f => (await sharp(attachmentImagePath(data, f)).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString('base64'))) };
}
