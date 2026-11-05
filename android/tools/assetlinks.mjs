import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export function statement(packageName, fingerprints) {
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName || '')) throw Error('Invalid package ID');
  const hashes = [...new Set(fingerprints.map(value => value.toUpperCase()))];
  if (!hashes.length || hashes.some(value => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value))) {
    throw Error('Supply real colon-separated SHA-256 certificate fingerprints (32 bytes)');
  }
  return { relation: ['delegate_permission/common.handle_all_urls'], target: {
    namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: hashes,
  } };
}

export function mergeStatements(entries, desired) {
  if (!Array.isArray(entries)) throw Error('Existing assetlinks must be an array');
  // Consolidate this relation alone; preserve other trust relationships verbatim.
  const same = entries.filter(item => item.target?.namespace === 'android_app'
    && item.target.package_name === desired.target.package_name
    && item.relation?.length === 1 && item.relation[0] === 'delegate_permission/common.handle_all_urls');
  const combined = statement(desired.target.package_name,
    [...same.flatMap(item => item.target.sha256_cert_fingerprints || []), ...desired.target.sha256_cert_fingerprints]);
  return [...entries.filter(item => !same.includes(item)), combined];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: {
    package: { type: 'string' }, fingerprint: { type: 'string', multiple: true },
    merge: { type: 'string' }, output: { type: 'string' }, live: { type: 'boolean' },
  } });
  const desired = statement(values.package, values.fingerprint || []);
  const entries = values.merge ? JSON.parse(readFileSync(values.merge, 'utf8')) : [];
  const output = mergeStatements(entries, desired);
  if (values.live) {
    const response = await fetch('https://lumen.nopuna.fr/.well-known/assetlinks.json', { redirect: 'manual' });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) {
      throw Error(`DAL requires HTTP 200 application/json without redirect; got ${response.status}`);
    }
    const published = await response.json();
    const matching = published.find(item => item.target?.namespace === 'android_app'
      && item.target.package_name === values.package && item.relation?.includes('delegate_permission/common.handle_all_urls')
      && desired.target.sha256_cert_fingerprints.every(hash => item.target.sha256_cert_fingerprints?.includes(hash)));
    if (!matching) throw Error('Published DAL does not contain requested package and certificates');
    console.log('Published package/certificates verified. Still test Android domain verification on device.');
  } else {
    const destination = resolve(values.output || 'dist/assetlinks.json');
    mkdirSync(resolve(destination, '..'), { recursive: true });
    writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Generated ${destination}; deploy separately after owner review.`);
  }
}
