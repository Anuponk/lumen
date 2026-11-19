import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { statement, mergeStatements } from './assetlinks.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(root + path, 'utf8');

test('DAL refuses absent, malformed and truncated certificates', () => {
  for (const hashes of [[], ['PLACEHOLDER'], ['AA:BB'], ['AA'.repeat(32)]]) {
    assert.throws(() => statement('fr.nopuna.lumen', hashes));
  }
  assert.throws(() => statement('wrong/package', ['AB:'.repeat(31) + 'AB']));
});
test('DAL uses supplied certificate and exact variant package without inventing either', () => {
  // Synthetic test value only; never used in generated distribution files.
  const hash = 'ab:'.repeat(31) + 'ab';
  const item = statement('fr.nopuna.lumen.debug', [hash, hash]);
  assert.deepEqual(item.target.sha256_cert_fingerprints, [hash.toUpperCase()]);
  assert.equal(item.target.package_name, 'fr.nopuna.lumen.debug');
  assert.deepEqual(item.relation, ['delegate_permission/common.handle_all_urls']);
});
test('official wrapper jar and Gradle distribution are pinned', () => {
  assert.equal(createHash('sha256').update(readFileSync(root + 'gradle/wrapper/gradle-wrapper.jar')).digest('hex'),
    '81a82aaea5abcc8ff68b3dfcb58b3c3c429378efd98e7433460610fecd7ae45f');
  assert.match(read('gradle/wrapper/gradle-wrapper.properties'), /distributionSha256Sum=20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78/);
});
test('DAL merging preserves other apps and relations without broadening their trust', () => {
  const first = 'AB:'.repeat(31) + 'AB';
  const second = 'CD:'.repeat(31) + 'CD';
  const other = statement('fr.example.other', [first]);
  const mixed = { ...statement('fr.nopuna.lumen', [first]), relation: ['delegate_permission/common.get_login_creds'] };
  const result = mergeStatements([other, mixed, statement('fr.nopuna.lumen', [first])], statement('fr.nopuna.lumen', [second]));
  assert.deepEqual(result.slice(0, 2), [other, mixed]);
  assert.deepEqual(result[2].target.sha256_cert_fingerprints, [first, second]);
  assert.deepEqual(result[2].relation, ['delegate_permission/common.handle_all_urls']);
  assert.throws(() => mergeStatements({}, statement('fr.nopuna.lumen', [first])));
});
test('launcher opens only HTTPS Lumen links and grants only Internet permission', () => {
  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.deepEqual([...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map(x => x[1]), ['android.permission.INTERNET']);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:scheme="https" android:host="\$\{lumenHost\}"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:authorities="\$\{applicationId\}.fileprovider"/);
  assert.match(read('app/build.gradle'), /lumenHost: 'lumen\.nopuna\.fr'/);
  assert.match(read('app/src/main/res/values/strings.xml'), /https:\/\/lumen\.nopuna\.fr/);
});
test('ABH ManageDataLauncherActivity is declared so the launcher cannot crash at startup', () => {
  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:name="com\.google\.androidbrowserhelper\.trusted\.ManageDataLauncherActivity"/);
  assert.match(manifest, /android:name="android\.support\.customtabs\.trusted\.MANAGE_SPACE_URL"/);
  assert.match(manifest, /android:value="https:\/\/\$\{lumenHost\}\/"/);
});

test('Android dependencies, SDK and toolchain are explicit; release never uses debug signer', () => {
  const build = read('app/build.gradle');
  for (const expression of [/compileSdk 36/, /targetSdk 36/, /minSdk 24/, /VERSION_17/, /androidbrowserhelper:2\.7\.3/]) assert.match(build, expression);
  assert.doesNotMatch(build, /signingConfig signingConfigs\.debug/);
  assert.match(build, /Provide all four LUMEN_UPLOAD_/);
});
test('icons cover pre-adaptive and adaptive launchers plus PNG TWA splash', () => {
  for (const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
    const png=readFileSync(root + `app/src/main/res/mipmap-${density}/ic_launcher.png`);
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
    assert.equal(png[25],6,'Legacy launcher PNG requires an alpha channel for its rounded shape');
  }
  assert.match(read('app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), /adaptive-icon/);
  assert.match(read('app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), /monochrome android:drawable="@drawable\/ic_monochrome"/);
  assert.equal(readFileSync(root + 'app/src/main/res/drawable-nodpi/splash.png').subarray(1,4).toString(), 'PNG');
});

test('#755: launcher, themed icon and Play icon reuse the approved constellation L geometry', async () => {
  const {iconGeometry,androidVector,SAFE_GROUP,NIGHT}=await import('./render-icons.mjs');
  const svg=readFileSync(new URL('../../icon-maskable.svg',import.meta.url),'utf8');
  const geometry=iconGeometry(svg);
  assert.equal(geometry.l,'M219 116L172 355L402 355','The L of the approved proposal');
  // The committed vectors are exactly what the generator produces from the SVG.
  const unix=text=>text.split(String.fromCharCode(13)).join('');
  assert.equal(unix(read('app/src/main/res/drawable/ic_foreground.xml')),androidVector(geometry,false));
  assert.equal(unix(read('app/src/main/res/drawable/ic_monochrome.xml')),androidVector(geometry,true));
  // Safe zone: every point of the L and its stars stays inside the 66 dp circle of the 108 dp canvas.
  const [s,tx,ty]=['scaleX','translateX','translateY'].map(k=>Number(SAFE_GROUP.split('android:'+k+'="')[1].split('"')[0]));
  const numbers=[geometry.l,...Object.values(geometry.shapes)].join(' ').match(/[0-9]+(?:[.][0-9]+)?/g).map(Number);
  const points=[];for(let i=0;i+1<numbers.length;i+=2)points.push([numbers[i],numbers[i+1]]);
  points.push([geometry.dot.cx+geometry.dot.r,geometry.dot.cy]);
  const radius=256*66/108;
  for(const [x,y] of points){const px=256+(x-256)*s+tx,py=256+(y-256)*s+ty;assert(Math.hypot(px-256,py-256)<=radius+1,'Point '+x+','+y+' leaves the adaptive safe zone')}
  assert.match(read('app/src/main/res/values/colors.xml'),new RegExp(NIGHT));
  const play=readFileSync(root+'store/play-icon-512.png');
  assert.equal(play.subarray(1,4).toString(),'PNG');assert.equal(play.readUInt32BE(16),512);assert.equal(play.readUInt32BE(20),512);
  assert(play.length<1024*1024,'Play listing icon under 1 MB');
});
test('no private signing material is present in packaging sources', () => {
  function scan(path) {
    for (const item of readdirSync(root + path, { withFileTypes: true })) {
      const relative = path + item.name;
      if (['.gradle', 'build', 'dist'].includes(item.name)) continue;
      if (item.isDirectory()) scan(relative + '/');
      else {
        assert.doesNotMatch(item.name, /\.(jks|keystore|p12|pfx|pem|key)$/i);
        if (!/\.(png|jar)$/.test(item.name)) assert.doesNotMatch(read(relative), /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/);
      }
    }
  }
  scan('');
});

test('#729 Play Billing: Digital Goods delegation, payment activity and service are declared', () => {
  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:name="\.BillingDelegationService"[\s\S]*?TRUSTED_WEB_ACTIVITY_SERVICE/);
  assert.match(manifest, /playbilling\.provider\.PaymentActivity"[\s\S]*?org\.chromium\.intent\.action\.PAY[\s\S]*?https:\/\/play\.google\.com\/billing/);
  assert.match(manifest, /playbilling\.provider\.PaymentService"[\s\S]*?org\.chromium\.intent\.action\.IS_READY_TO_PAY/);
  assert.match(read('app/build.gradle'), /implementation project\(':billing'\)/);
  assert.match(read('billing/build.gradle'), /com\.android\.billingclient:billing:8\.3\.0/);
  const billingSource = 'billing/src/main/java/';
  const activity = read(billingSource + 'PaymentActivity.java');
  assert.match(activity, /PaymentVerifier\.shouldAllowPayments[\s\S]*obfuscatedAccountId\.matches\("\[0-9a-f\]\{64\}"\)[\s\S]*mWrapper = BillingWrapperFactory/);
  assert.match(activity, /queryProductDetails\(BillingClient\.ProductType\.INAPP/);
  assert.doesNotMatch(activity, /queryProductDetails\(BillingClient\.ProductType\.SUBS/);
  assert.match(read(billingSource + 'PlayBillingWrapper.java'), /setObfuscatedAccountId\(methodData\.obfuscatedAccountId\)/);
  assert.match(read(billingSource + 'GetDetailsCall.java'), /lumen_internal_bound_checkout_v1/);
  assert.doesNotMatch(read(billingSource + 'digitalgoods/Logging.java'), /Log\.[a-z]+\([^\n]+\+ token/);
  const service = read('app/src/main/java/fr/nopuna/lumen/BillingDelegationService.java');
  assert.match(service, /extends DelegationService/);
  assert.match(service, /registerExtraCommandHandler\(new DigitalGoodsRequestHandler\(getApplicationContext\(\)\)\)/);
});
