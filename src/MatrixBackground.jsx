import React,{useEffect,useRef} from 'react';

export function MatrixBackground(){
 const canvas=useRef(null);
 useEffect(()=>{
  const node=canvas.current,context=node.getContext('2d');if(!context)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const glyphs='アイウエオカキクケコサシスセソ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let width=0,height=0,columns=[],frame=0,last=0;
  function resize(){
   const bounds=node.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);
   if(!bounds.width||!bounds.height)return;
   const pixelWidth=Math.round(bounds.width*ratio),pixelHeight=Math.round(bounds.height*ratio);
   if(pixelWidth===node.width&&pixelHeight===node.height&&width===bounds.width&&height===bounds.height)return;
   // Resizing a canvas clears it. Retain its trails at the same logical positions.
   const previous=width&&height?document.createElement('canvas'):null;
   if(previous){previous.width=node.width;previous.height=node.height;previous.getContext('2d').drawImage(node,0,0);}
   const previousWidth=width,previousHeight=height;
   width=bounds.width;height=bounds.height;node.width=pixelWidth;node.height=pixelHeight;
   context.setTransform(ratio,0,0,ratio,0,0);context.font='12px ui-monospace,monospace';
   if(previous)context.drawImage(previous,0,0,previous.width,previous.height,0,0,previousWidth,previousHeight);
   // Existing columns keep their positions and speeds; only newly exposed columns start fresh.
   while(columns.length<Math.ceil(width/25))columns.push({y:Math.random()*height,speed:1.2+Math.random()*2,active:Math.random()>.4});
  }
  function draw(time){
   if(document.hidden||motion.matches){frame=0;return;}
   if(time-last>90){
    last=time;
    // Fade existing glyphs without painting a solid rectangle over the page.
    context.globalCompositeOperation='destination-out';context.fillStyle='rgba(0,0,0,.075)';context.fillRect(0,0,width,height);
    context.globalCompositeOperation='source-over';context.fillStyle='#c4a5e8';
    columns.forEach((column,i)=>{
     column.y+=column.speed*3;
     if(column.y>height+30){column.y=-Math.random()*200;column.active=Math.random()>.4;}
     if(column.active)context.fillText(glyphs[Math.floor(Math.random()*glyphs.length)],i*25,column.y);
    });
   }
   frame=requestAnimationFrame(draw);
  }
  function sync(){cancelAnimationFrame(frame);frame=0;last=0;if(motion.matches)context.clearRect(0,0,width,height);else if(!document.hidden)frame=requestAnimationFrame(draw);}
  resize();const observer=new ResizeObserver(resize);observer.observe(node);sync();
  document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);};
 },[]);
 return <canvas ref={canvas} className="matrix-background" aria-hidden="true"/>;
}
