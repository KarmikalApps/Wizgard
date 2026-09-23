import React from 'react';
const names={imageModel:'Image model',width:'Width',height:'Height',steps:'Steps',imageGuidance:'Guidance',seed:'Seed',backend:'Image runtime',videoModel:'Video model',videoWidth:'Width',videoHeight:'Height',videoSeconds:'Requested seconds',videoFps:'Frame rate',videoAudio:'Sound',voice:'Voice',language:'Language',voiceStyle:'Voice style',musicSeconds:'Requested seconds',sfxSeconds:'Requested seconds',seconds:'Actual seconds',fps:'Actual frame rate',sampleRate:'Sample rate',referenceCount:'Image references'};
const fields={image:['imageModel','width','height','steps','imageGuidance','backend'],video:['videoModel','videoWidth','videoHeight','videoSeconds','videoFps','videoAudio'],music:['musicSeconds'],speech:['voice','language','voiceStyle'],sfx:['sfxSeconds']};
export function LibraryDetails({item}){
 const record=item.generation;
 if(!record)return <div className="asset-details"><p>Generation settings were not recorded for this older asset.</p></div>;
 const values=[['Model',item.model],['Seed',record.actual?.seed??record.settings?.seed],...(fields[record.mode]||[]).map(key=>[names[key],record.settings?.[key]]),...['seconds','sampleRate','referenceCount'].map(key=>[names[key],record.actual?.[key]])].filter(([,value])=>value!==undefined&&value!==null&&value!=='');
 return <div className="asset-details"><dl>{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{typeof value==='boolean'?value?'On':'Off':String(value)}</dd></div>)}</dl>{record.source==='partial'&&<p>Only some settings could be recovered for this older asset.</p>}<details><summary>All recorded settings</summary><pre>{JSON.stringify(record,null,2)}</pre></details></div>;
}
