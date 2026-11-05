import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
const { validateImageFile, validateImageSize, initialImageCrop, imageCropPixels, fitImageSize, publicImageUrl } = createRequire(import.meta.url)("./imageProcessing.ts");

test("only nonempty JPEG, PNG and WebP files within the configured limit are accepted", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.doesNotThrow(() => validateImageFile({type, size: 1024}, 1));
  for (const type of ["image/svg+xml", "image/gif", "application/pdf", ""]) assert.throws(() => validateImageFile({type, size: 1024}, 1));
  for (const size of [0, 1048577]) assert.throws(() => validateImageFile({type:"image/png",size}, 1));
  assert.throws(() => validateImageFile({type:"image/png",size:1}, 0));
});
test("decoded image dimensions are checked independently of compressed file size", () => {
  assert.doesNotThrow(() => validateImageSize({width:8000,height:5000}));
  for (const size of [{width:8000,height:5001},{width:0,height:1},{width:1.5,height:1}]) assert.throws(() => validateImageSize(size));
});
test("initial fixed-aspect crops are centered and bounded in natural image pixels", () => {
  const image = {width:1200,height:800};
  const crop = initialImageCrop(image, 1);
  assert.deepEqual(imageCropPixels(crop,image), {x:200,y:0,width:800,height:800});
  assert.deepEqual(imageCropPixels(initialImageCrop(image),image), {x:0,y:0,width:1200,height:800});
  assert.throws(() => initialImageCrop(image, 0));
});
test("percentage crops remain correct when the image display is resized", () => {
  const crop = {unit:'%',x:25,y:25,width:50,height:50};
  assert.deepEqual(imageCropPixels(crop,{width:1200,height:800}),{x:300,y:200,width:600,height:400});
  assert.deepEqual(imageCropPixels(crop,{width:2400,height:1600}),{x:600,y:400,width:1200,height:800});
  assert.throws(() => imageCropPixels({...crop,x:80},{width:1200,height:800}));
  assert.throws(() => imageCropPixels({...crop,width:0},{width:1200,height:800}));
});
test("output dimensions are limited proportionally and never enlarged", () => {
  assert.deepEqual(fitImageSize({width:8000,height:4000}),{width:4096,height:2048});
  assert.deepEqual(fitImageSize({width:300,height:600}),{width:300,height:600});
});
test("only public HTTPS URLs can become the field value", () => {
  assert.equal(publicImageUrl('https://res.cloudinary.com/demo/image/upload/a.webp'),'https://res.cloudinary.com/demo/image/upload/a.webp');
  for (const value of [null, '', 'blob:https://localhost/example', 'data:image/png;base64,abc', 'javascript:alert(1)', 'http://example.com/a.png', 'https://user:password@example.com/a.png']) assert.throws(() => publicImageUrl(value));
});
