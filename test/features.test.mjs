import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { receiveAttachments, loadAttachments, attachmentContext, validateAttachmentIds, selectExcerpts } from '../server/attachments.mjs';
import { validateRequest, routeFallback } from '../server/policy.mjs';
import { publicAddress, publicURL } from '../server/web.mjs';
import { buildVideoWorkflow, findVideoOutput } from '../server/video-workflow.mjs';

function testPDF() {
  const stream = 'BT /F1 12 Tf 50 700 Td (The verification code is LANTERN-73.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object,i) => { offsets.push(pdf.length); pdf += (i+1)+' 0 obj\n'+object+'\nendobj\n'; });
  const xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return pdf;
}

test('attachment uploads persist readable text, enforce 10 files and roll back failed batches', async () => {
  const data = await mkdtemp(join(tmpdir(), 'wizgard-files-'));
  const server = http.createServer(async (req,res) => { try { res.end(JSON.stringify(await receiveAttachments(req,data))); } catch(e) { res.statusCode = e.status || 500; res.end(JSON.stringify({error:e.message})); } });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const send = async files => { const body = new FormData(); files.forEach(([name,text]) => body.append('files', new Blob([text]), name)); return fetch('http://127.0.0.1:' + server.address().port, {method:'POST',body}); };
  try {
    const response = await send(Array.from({length:10},(_,i) => ['note'+i+'.txt', 'The project code is ORCHID-42.']));
    assert.equal(response.status,200); const files = await response.json(); assert.equal(files.length,10);
    assert.equal((await loadAttachments(data,files.map(f=>f.id))).length,10);
    assert.match((await attachmentContext(data,[files[0]],'project code')).text,/ORCHID-42/);
    assert.equal((await send(Array.from({length:11},(_,i)=>['x'+i+'.txt','data']))).status,413);
    const before = (await readdir(join(data,'attachments'))).length;
    assert.equal((await send([['good.txt','text'],['bad.exe','bad']])).status,400);
    assert.equal((await readdir(join(data,'attachments'))).length,before);
    assert.equal((await send([['bad.pdf','not a PDF']])).status,400);
    const pdf = await send([['test.pdf',testPDF()]]); assert.equal(pdf.status,200);
    const parsed = await pdf.json(); assert.equal(parsed[0].pages,1);
    assert.match((await attachmentContext(data,parsed,'verification code')).text,/LANTERN-73/);
  } finally { server.closeAllConnections(); await new Promise(r=>server.close(r)); await rm(data,{recursive:true,force:true}); }
});
test('file identifiers, excerpts and video bounds reject invalid inputs', () => {
  assert.throws(()=>validateAttachmentIds(['../../private']));
  assert.throws(()=>validateRequest({prompt:'video',mode:'video',settings:{videoSeconds:999}}));
  assert.equal(routeFallback('Create a video of a boat'),'video');
  const text = 'intro '.repeat(2000) + 'ORCHID is the answer. '.repeat(40);
  assert.match(selectExcerpts(text,'ORCHID',2200),/ORCHID/);
  assert.equal(validateRequest({prompt:'hi',mode:'chat'}).attachmentIds.length,0);
});
test('web reader blocks private addresses, mapped IPv6 and DNS answers', async () => {
  for (const address of ['127.0.0.1','10.0.0.2','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fc00::1','0.0.0.0']) assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress('1.1.1.1'),true);
  await assert.rejects(publicURL('http://public.example',async()=>[{address:'127.0.0.1',family:4}]));
  await assert.rejects(publicURL('file:///etc/passwd'));
  await assert.rejects(publicURL('http://user:pass@example.com'));
});
test('video references become ordered guides and are cropped before decoding', () => {
  const graph = buildVideoWorkflow({checkpoint:'model',encoder:'encoder',lora:'speed',prompt:'boat',seed:1,width:512,height:320,frames:49,sourceImages:['one.png','two.png','three.png'],outputId:'test'});
  assert.deepEqual([graph['31'].inputs.frame_idx,graph['33'].inputs.frame_idx,graph['35'].inputs.frame_idx],[0,24,48]);
  assert.deepEqual(graph['17'].inputs.samples,['60',2]);
  assert.deepEqual(graph['12'].inputs.positive,['35',0]);
  assert.equal(findVideoOutput({'20':{images:[{filename:'clip.mp4',type:'output'}]}}).filename,'clip.mp4');
});
