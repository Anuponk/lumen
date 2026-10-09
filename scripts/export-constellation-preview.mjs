#!/usr/bin/env node
// Explicitly export a local HTML preview; never modify game catalogue.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {renderConstellationPreviewHtml} from "./render-constellation-preview.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const destination=path.join(root,"artifacts","constellation-preview.html");
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,renderConstellationPreviewHtml(),"utf8");
console.log("Constellation preview generated: "+destination);
