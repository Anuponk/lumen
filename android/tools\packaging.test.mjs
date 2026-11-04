import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { statement } from './assetlinks.mjs';
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
test('Android dependencies, SDK and toolchain are explicit; release never uses debug signer', () => {
  const build = read('app/build.gradle');
  for (const expression of [/compileSdk 36/, /targetSdk 36/, /minSdk 24/, /VERSION_17/, /androidbrowserhelper:2\.7\.3/]) assert.match(build, expression);
  assert.doesNotMatch(build, /signingConfig signingConfigs\.debug/);
  assert.match(build, /Provide all four LUMEN_UPLOAD_/);
});
test('icons cover pre-adaptive and adaptive launchers plus PNG TWA splash', () => {
  for (const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']) {
    assert.equal(readFileSync(root + `app/src/main/res/mipmap-${density}/ic_launcher.png`).subarray(1,4).toString(), 'PNG');
  }
  assert.match(read('app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'), /adaptive-icon/);
  assert.equal(readFileSync(root + 'app/src/main/res/drawable-nodpi/splash.png').subarray(1,4).toString(), 'PNG');
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
