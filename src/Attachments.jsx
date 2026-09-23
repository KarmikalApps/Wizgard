import React, {useState} from 'react';
import {Image, FileText, FileCode2, FileSpreadsheet, File, X} from 'lucide-react';

function fileType(file) {
  const ext=(file.name||'').split('.').pop().toLowerCase();
  if(file.kind==='image')return {Icon:Image,label:'Image',format:['png','jpg','jpeg','webp'].includes(ext)?ext.toUpperCase():'Image'};
  if(ext==='pdf')return {Icon:FileText,label:'PDF document',format:'PDF'};
  if(ext==='docx')return {Icon:FileText,label:'Word document',format:'DOCX'};
  if(ext==='csv')return {Icon:FileSpreadsheet,label:'Spreadsheet',format:'CSV'};
  if(['js','jsx','ts','tsx','py','html','css','xml','json','yaml','yml','sql','sh','ini'].includes(ext))return {Icon:FileCode2,label:'Code file',format:ext.toUpperCase()};
  if(['txt','md','log'].includes(ext))return {Icon:FileText,label:'Text document',format:ext.toUpperCase()};
  return {Icon:File,label:'Document',format:'File'};
}
function AttachmentVisual({file,compact=false}) {
  const [failed,setFailed]=useState(false),{Icon,label}=fileType(file);
  const preview=file.kind==='image'&&file.previewUrl&&!failed;
  return <span className={'attachment-visual '+(compact?'compact ':'')+(preview?'has-preview':'file-symbol')} aria-hidden="true">
    {preview?<img src={file.previewUrl} alt="" onError={()=>setFailed(true)}/>:<Icon size={compact?21:30} strokeWidth={1.6}/>}
    {preview&&<span className="attachment-type-badge" title={label}><Icon size={compact?10:13}/></span>}
  </span>;
}
export function MessageAttachments({files}) {
  return <div className="message-attachments" role="group" aria-label="Prompt attachments">{files.map(file=>{
    const {label,format}=fileType(file);
    return <a className="message-attachment" key={file.id} href={file.url} download={file.name} aria-label={label+': '+file.name} title={[file.name,file.warning].filter(Boolean).join(' — ')}>
      <AttachmentVisual file={file}/><span className="attachment-name">{file.name}</span><span className="attachment-format">{format}</span>
    </a>;
  })}</div>;
}
export function ComposerAttachments({files,disabled,onRemove}) {
  return <div className="attachment-tray" role="group" aria-label="Attached files">{files.map((file,index)=>{
    const {label,format}=fileType(file);
    return <div className="attachment-chip" key={file.id} title={file.name}>
      <AttachmentVisual file={file} compact/><span className="attachment-chip-copy"><span className="attachment-name">{index+1}. {file.name}</span><span className="attachment-format">{label} · {format}</span></span>
      <button type="button" disabled={disabled} onClick={()=>onRemove(file.id)} aria-label={'Remove '+file.name}><X size={14}/></button>
    </div>;
  })}</div>;
}
