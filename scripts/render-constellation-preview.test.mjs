import test from "node:test";
import assert from "node:assert/strict";
import {renderConstellationPreviewHtml} from "./render-constellation-preview.mjs";
test("renders all constellation silhouettes without publishing content",()=>{
 const html=renderConstellationPreviewHtml();
 assert.equal((html.match(/<article class="card"/g)||[]).length,88);
 assert.equal((html.match(/data-published="true"/g)||[]).length,24);
 assert.equal((html.match(/data-published="false"/g)||[]).length,64);
 assert.ok(html.includes('viewBox="0 0 280 120"'));
});
test("escapes constellation names in markup",()=>{
 const html=renderConstellationPreviewHtml([{id:"x",name:"<unsafe>",published:false,points:[[0,0],[1,1]],edges:[[0,1]]}]);
 assert.ok(html.includes("&lt;unsafe&gt;"));
 assert.ok(!html.includes("<unsafe>"));
});
