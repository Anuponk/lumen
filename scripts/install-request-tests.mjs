// #748: install request from the presentation page (?install=1) and its QR code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {consumeInstallRequest,isIosDevice,requestedInstallCopy} from '../src/ui/install-request.js';
import {INSTALL_URL,QR_FILE,qrSvg,qrMatrix} from './landing-qr.mjs';

const fakeWindow=href=>{const calls=[];return {calls,location:{href},history:{state:{keep:1},replaceState:(...a)=>calls.push(a)}}};
// The request is read once and removed, other parameters and the hash are kept.
let w=fakeWindow('https://lumen.nopuna.fr/?qa=new&install=1#sky');
assert.equal(consumeInstallRequest(w),true);assert.deepEqual(w.calls,[[{keep:1},'','/?qa=new#sky']]);
w=fakeWindow('https://lumen.nopuna.fr/?install=1');assert.equal(consumeInstallRequest(w),true);assert.equal(w.calls[0][2],'/');
for(const href of ['https://lumen.nopuna.fr/','https://lumen.nopuna.fr/?install=0','https://lumen.nopuna.fr/?install=yes']){
 w=fakeWindow(href);assert.equal(consumeInstallRequest(w),false,href);assert.equal(w.calls.length,0,'No URL change without a request');
}
assert.equal(consumeInstallRequest({location:{href:'::bad'}}),false,'A broken URL never throws');

// Copy: the native prompt when available, otherwise the exact manual steps.
assert.equal(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'),true);assert.equal(isIosDevice('Mozilla/5.0 (Linux; Android 14)'),false);
assert.equal(requestedInstallCopy({prompt:true,ios:true}).button,'Installer LUMEN');
assert.match(requestedInstallCopy({prompt:false,ios:true}).copy,/Partager, puis « Sur l’écran d’accueil »/);
assert.match(requestedInstallCopy({prompt:false,ios:false}).copy,/menu ⋮/);
for(const v of [{prompt:false,ios:true},{prompt:false,ios:false}])assert.equal(requestedInstallCopy(v).button,'J’ai compris','No dead install button without a prompt');

// Game wiring: explicit request bypasses the quest-12 rule but never asks an installed app,
// waits for the first-visit welcome, and stays tappable during the tutorial (#722 lesson).
const game=fs.readFileSync('src/ui/game-screen.js','utf8');
const offer=game.slice(game.indexOf('async function offerRequestedInstall('),game.indexOf('async function maybeOfferInstall('));
assert.match(offer,/lumenAlreadyInstalled\(\)/);assert.doesNotMatch(offer,/solvedCount\(\)/);assert.match(offer,/firstWelcome\?\.active/);
assert.match(game,/target\.closest\("#installOptin,/,'Install sheet allowed during scripted learning');
assert.match(game,/const lumenInstallRequested=consumeInstallRequest\(window\);/);
assert(game.indexOf('const lumenInstallRequested=consumeInstallRequest(window);')<game.indexOf('const firstWelcomeEligible='),'The request is removed before the first-visit welcome checks the URL');

// Presentation page: a phone link and a QR code that encodes the same address.
const page=fs.readFileSync('decouvrir.html','utf8');
assert.match(page,/<a class="install-mobile" href="\/\?install=1">Installer sur mon téléphone<\/a>/);
assert.match(page,/<img src="\/src\/landing\/install-qr\.svg"/);
assert.equal(INSTALL_URL,'https://lumen.nopuna.fr/?install=1');
assert.equal(fs.readFileSync(QR_FILE,'utf8').replace(/\r\n/g,'\n'),qrSvg(INSTALL_URL),'QR file regenerated from the vendored encoder (node scripts/landing-qr.mjs)');
const m=qrMatrix(INSTALL_URL),n=m.length;
for(const [r,c] of [[0,0],[0,n-7],[n-7,0]])for(let i=0;i<7;i++)assert.equal(m[r][c+i]&&m[r+6][c+i]&&m[r+i][c]&&m[r+i][c+6],true,'Finder pattern at '+[r,c]);
console.log('install-request-tests: URL request, copy, game wiring, page link and QR code OK');
