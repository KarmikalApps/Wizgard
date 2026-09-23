import http from 'node:http';
import { Readable } from 'node:stream';
// Native local engines may be frozen for longer than fetch's default body timeout.
export function localFetch(url,{method='GET',body,headers={},signal}={}) {
  const target=new URL(url);if(target.protocol!=='http:'||target.hostname!=='127.0.0.1')throw new Error('Local engine URL required.');
  return new Promise((resolve,reject)=>{
    const request=http.request(target,{method,headers,signal},response=>{
      resolve(new Response(Readable.toWeb(response),{status:response.statusCode,headers:response.headers}));
    });request.on('error',reject);if(body)request.write(body);request.end();
  });
}
