import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const {createCloudinaryImageUploader} = createRequire(import.meta.url)('./cloudinary.ts');

test('Cloudinary adapter reports progress, rejects failed/unsafe responses and supports cancellation', async () => {
  const original = globalThis.XMLHttpRequest;
  const requests = [];
  class MockRequest {
    upload = {};
    response = null;
    status = 0;
    constructor() { requests.push(this); }
    open(method,url) { this.method=method; this.url=url; }
    send(body) { this.body=body; }
    abort() { this.onabort?.(); }
  }
  globalThis.XMLHttpRequest = MockRequest;
  try {
    const upload = createCloudinaryImageUploader({cloudName:'example',uploadPreset:'images',folder:'samples'});
    const file = new File(['image'], 'image.webp', {type:'image/webp'});
    const progress = [];
    let controller = new AbortController();
    const result = upload(file,{signal:controller.signal,onProgress:value=>progress.push(value)});
    let request = requests.at(-1);
    assert.equal(request.url,'https://api.cloudinary.com/v1_1/example/image/upload');
    assert.equal(request.body.get('upload_preset'),'images');
    assert.equal(request.body.get('file').name,'image.webp');
    request.upload.onprogress({lengthComputable:true,loaded:100,total:100});
    assert.deepEqual(progress,[99]);
    request.status=200; request.response={secure_url:'https://res.cloudinary.com/example/image/upload/image.webp'}; request.onload();
    assert.equal(await result,request.response.secure_url);
    assert.deepEqual(progress,[99,100]);
    const failure=upload(file,{signal:controller.signal,onProgress:()=>{}});
    request = requests.at(-1);
    request.status=400; request.response={error:{message:'Upload preset not found'}}; request.onload();
    await assert.rejects(failure,/Upload preset not found/);
    const unsafe=upload(file,{signal:controller.signal,onProgress:()=>{}});
    request = requests.at(-1);
    request.status=200; request.response={secure_url:'data:image/png;base64,example'}; request.onload();
    await assert.rejects(unsafe,/URL no válida/);
    const cancelled=upload(file,{signal:controller.signal,onProgress:()=>{}}); controller.abort();
    await assert.rejects(cancelled,{name:'AbortError'});
    await assert.rejects(upload(file,{signal:controller.signal,onProgress:()=>{}}),{name:'AbortError'});
    controller=new AbortController();
    await assert.rejects(createCloudinaryImageUploader({cloudName:'',uploadPreset:''})(file,{signal:controller.signal,onProgress:()=>{}}),/Configura/);
  } finally { globalThis.XMLHttpRequest = original; }
});
