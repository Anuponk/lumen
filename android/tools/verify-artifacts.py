"""Validate compiled packages, not just source text. No production signing needed."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SDK = Path(os.environ['ANDROID_HOME'])
BUNDLETOOL = Path(sys.argv[1]).resolve()
ANDROID = '{http://schemas.android.com/apk/res/android}'
EXPECTED = dict(line.strip().split('=', 1) for line in (ROOT / 'release.properties').read_text().splitlines()
                if line.strip() and not line.startswith('#'))


def run(*args):
    return subprocess.check_output([str(arg) for arg in args], text=True, stderr=subprocess.STDOUT)


def verify_manifest(xml, package, debug):
    manifest = ET.fromstring(xml)
    assert manifest.attrib['package'] == package
    assert manifest.attrib[ANDROID + 'versionCode'] == EXPECTED['versionCode']
    assert manifest.attrib[ANDROID + 'versionName'] == EXPECTED['versionName']
    sdk = manifest.find('uses-sdk')
    assert sdk.attrib[ANDROID + 'minSdkVersion'] == '24'
    assert sdk.attrib[ANDROID + 'targetSdkVersion'] == '36'
    permissions = {item.attrib[ANDROID + 'name'] for item in manifest.findall('uses-permission')}
    receiver_permission = package + '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
    assert permissions == {'android.permission.INTERNET', receiver_permission}, permissions
    declared = {item.attrib[ANDROID + 'name']: item.attrib[ANDROID + 'protectionLevel']
                for item in manifest.findall('permission')}
    assert declared == {receiver_permission: 'signature'}, declared
    app = manifest.find('application')
    assert app.attrib[ANDROID + 'usesCleartextTraffic'] == 'false'
    assert (app.attrib.get(ANDROID + 'debuggable') == 'true') == debug
    activity = next(item for item in app.findall('activity')
                    if item.attrib[ANDROID + 'name'].endswith('.LauncherActivity'))
    assert activity.attrib[ANDROID + 'exported'] == 'true'
    links = next(item for item in activity.findall('intent-filter')
                 if item.attrib.get(ANDROID + 'autoVerify') == 'true')
    assert {(item.attrib[ANDROID + 'scheme'], item.attrib[ANDROID + 'host'])
            for item in links.findall('data')} == {('https', 'lumen.nopuna.fr')}


report = {'artifacts': [], 'physicalDeviceTested': False, 'productionSigned': False}
apk = ROOT / 'app/build/outputs/apk/debug/app-debug.apk'
signature = run(SDK / 'build-tools/35.0.0/apksigner', 'verify', '--verbose', '--print-certs', apk)
assert 'Verified' in signature
verify_manifest(run(SDK / 'cmdline-tools/latest/bin/apkanalyzer', 'manifest', 'print', apk),
                EXPECTED['applicationId'] + '.debug', True)
report['debugCertificate'] = signature
for variant in ('debug', 'release'):
    bundle = ROOT / f'app/build/outputs/bundle/{variant}/app-{variant}.aab'
    run('java', '-jar', BUNDLETOOL, 'validate', f'--bundle={bundle}')
    verify_manifest(run('java', '-jar', BUNDLETOOL, 'dump', 'manifest', f'--bundle={bundle}'),
                    EXPECTED['applicationId'] + ('.debug' if variant == 'debug' else ''), variant == 'debug')
    with zipfile.ZipFile(bundle) as archive:
        names = archive.namelist()
        assert 'base/dex/classes.dex' in names
        assert not any(name.endswith('.so') for name in names), 'Re-evaluate 16 KB native library compatibility'
        signatures = [name for name in names if name.startswith('META-INF/') and name.endswith('.SF')]
        assert bool(signatures) == (variant == 'debug'), 'CI must use no release signing secret'
    if variant == 'debug':
        assert 'jar verified.' in run('jarsigner', '-verify', bundle)
    report['artifacts'].append({'name': bundle.name, 'sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
                                'signed': variant == 'debug'})
report['artifacts'].append({'name': apk.name, 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'signed': True})
(ROOT / 'app/build/outputs/packaging-verification.json').write_text(json.dumps(report, indent=2) + '\n')
print('APK signature, AAB structures, SDK/package/version, permissions and HTTPS links verified.')
