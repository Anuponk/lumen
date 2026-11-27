import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import { parseFragment } from 'parse5';
import { locales } from '../src/ui/i18n.js';
import {SEASONAL_EVENTS,DAILY_NAMES} from '../src/campaign/seasonal-events.js';

// Shared Node/Deno catalogues cannot import the entire UI translation registry.
// Validate their language coverage instead of adding strings to historical debt.
export function seasonalCatalogueIssues(events=SEASONAL_EVENTS,names=DAILY_NAMES){
  const issues=[];
  for(const event of [...events,{id:'ordinary-daily',labels:Object.fromEntries(Object.entries(names).map(([locale,title])=>[locale,{title}]))}]){
    const labels=event.labels??{},keys=Object.keys(labels.fr??{}).sort();
    if(!keys.length)issues.push(event.id+': missing French labels');
    for(const locale of ['fr','en','es']){
      const copy=labels[locale];
      if(!copy||JSON.stringify(Object.keys(copy).sort())!==JSON.stringify(keys)){issues.push(event.id+': incomplete '+locale);continue}
      for(const key of keys){
        const value=copy[key],base=labels.fr[key];
        if(typeof value!=='string'||!value.trim()||typeof base!=='string'||placeholders(value)!==placeholders(base))issues.push(event.id+': invalid '+locale+'.'+key);
      }
    }
  }
  return issues;
}
const seasonalStrings=new Set([...Object.values(DAILY_NAMES),...SEASONAL_EVENTS.flatMap(event=>Object.values(event.labels).flatMap(Object.values))].map(value=>value.replace(/\s+/g,' ').trim()));

const sourceRoots = ['src/ui', 'src/game', 'src/campaign', 'src/privacy', 'src/landing'];
const debtPath = 'scripts/i18n-visible-baseline.json';
const reviewPath = 'scripts/i18n-catalogue-review.json';
const translatedScopes = {
  'src/game/engine.js': ['guidedConflictForAction'],
  'src/ui/game-screen.js': ['showGuidedConflict', 'renderGuidedConflictCopy'],
  'src/ui/guided-conflict-copy.js': ['guidedConflictCopy'],
};
const textAttributes = new Set(['aria-label', 'aria-description', 'alt', 'placeholder', 'title']);
const textProperties = new Set([...textAttributes, 'textContent', 'innerText']);
const humanWord = /\p{L}{2,}/u;
const markup = /<\/?[a-z][a-z0-9-]*(?:\s|>)/i;
const normalize = value => value.replace(/\s+/g, ' ').trim();
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);

function markupCopy(source, record, reference) {
  function visit(node) {
    if (['script', 'style'].includes(node.tagName)) return;
    const attributes = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    if (node.nodeName === '#text') record(node.value, true);
    for (const marker of ['data-game-text', 'data-game-label', 'data-game-title', 'data-game-placeholder', 'data-pwa-copy']) {
      if (attributes[marker]) reference(attributes[marker]);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (!textAttributes.has(name)) continue;
      const marker = { 'aria-label': 'data-game-label', title: 'data-game-title', placeholder: 'data-game-placeholder' }[name];
      if (!(marker && attributes[marker])) record(value, true);
    }
    if (attributes['data-game-text'] || attributes['data-pwa-copy']) return;
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  }
  visit(parseFragment(source));
}

function propertyName(node) {
  return node?.property?.name ?? node?.property?.value;
}
function isTextSink(node, ancestors) {
  return ancestors.some(parent =>
    (parent.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression' && textProperties.has(propertyName(parent.left))) ||
    (parent.type === 'CallExpression' &&
      (['alert', 'confirm', 'prompt', 'showRewardToast', 'showHintMessage'].includes(parent.callee.name) ||
        (propertyName(parent.callee) === 'setAttribute' && textAttributes.has(parent.arguments[0]?.value)))) ||
    (parent.type === 'Property' && parent.value === node && ['title', 'label', 'copy', 'message'].includes(parent.key.name)));
}

export function visibleCandidates(source, path, reference = () => {}, onCandidate = () => {}) {
  const results = [];
  function record(raw, direct = false, scope) {
    const copy = normalize(raw);
    if (!humanWord.test(copy)) return;
    if (!direct && !/\p{L}{2,}[ \t’']+\p{L}{2,}|[àâçèéêëîïôùûüœÀÂÇÈÉÊËÎÏÔÙÛÜŒ]/u.test(copy)) return;
    if (/^(?:https?:|[/.#]|[a-z]+\/[a-z]+$)/i.test(copy)) return;
    results.push(copy);
    onCandidate(copy, scope);
  }
  if (path.endsWith('.html')) {
    markupCopy(source, record, reference);
  } else {
    function visit(node, ancestors) {
      const parent = ancestors.at(-1);
      if (node.type === 'CallExpression' && node.callee.object?.name === 'console') return;
      if (node.type === 'Literal' || node.type === 'TemplateLiteral') {
        const candidate = node.type === 'TemplateLiteral'
          ? node.quasis.map(part => part.value.cooked ?? part.value.raw).join('{…}')
          : node.value;
        if (typeof candidate === 'string' && parent?.key !== node) {
          const inMessageKey = ancestors.some((ancestor, index) =>
            ancestor.type === 'CallExpression' && ancestor.callee.name === 't' &&
              ancestor.arguments[0] === (ancestors[index + 1] ?? node));
          if (inMessageKey && /^[a-z][\w]+\.[a-z][\w.]+$/i.test(candidate)) reference(candidate);
          const direct = isTextSink(node, ancestors);
          const isReference = inMessageKey || parent?.type === 'ImportDeclaration' ||
            parent?.type === 'MemberExpression' || parent?.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(parent.operator) ||
            parent?.type === 'CallExpression' && parent.arguments[0] === node &&
              ['setAttribute', 'getElementById', 'querySelector', 'querySelectorAll', 'closest', 'matches'].includes(propertyName(parent.callee));
          if (!isReference) {
            const scope = ancestors.findLast(ancestor => ancestor.type === 'FunctionDeclaration')?.id?.name;
            const recordCandidate = (raw, fromMarkup) => record(raw, direct || fromMarkup, scope);
            if (markup.test(candidate)) markupCopy(candidate, recordCandidate, reference);
            else recordCandidate(candidate, false);
          }
        }
      }
      for (const value of Object.values(node)) {
        if (value?.type) visit(value, [...ancestors, node]);
        else if (Array.isArray(value)) for (const child of value) if (child?.type) visit(child, [...ancestors, node]);
      }
    }
    visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }), []);
  }
  return results;
}

function sourceFiles() {
  const javascript = sourceRoots.flatMap(root => readdirSync(root, { recursive: true }).map(file => join(root, file).replaceAll('\\', '/')))
    .filter(file => file.endsWith('.js') && !file.startsWith('src/ui/locales/'));
  return ['index.html', ...javascript].sort();
}
export function inventory(reference = () => {}, onProtectedCopy = () => {}) {
  return Object.fromEntries(sourceFiles().map(file => [
    file, visibleCandidates(readFileSync(file, 'utf8'), file, key => reference(key, file),
      (copy, scope) => {
        if (translatedScopes[file]?.includes(scope)) onProtectedCopy(file, scope, copy);
      }).filter(copy=>file!=='src/campaign/seasonal-events.js'||!seasonalStrings.has(copy)),
  ]).filter(([, list]) => list.length));
}
export function inventoryHashes(entries) {
  return Object.fromEntries(Object.entries(entries).map(([file, list]) => [file, list.map(hash).sort()]));
}
export function newlyVisible(current, baseline, fingerprint = hash) {
  const failures = [];
  for (const [file, candidates] of Object.entries(current)) {
    const counts = new Map();
    for (const id of baseline[file] ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const copy of candidates) {
      const id = fingerprint(copy);
      if (counts.get(id)) counts.set(id, counts.get(id) - 1);
      else failures.push({ file, copy });
    }
  }
  return failures;
}

const placeholders = value => [...new Set(value.match(/\{\w+\}/g))].sort().join(',');
function forms(entry) {
  if (typeof entry === 'string') return [entry];
  if (!entry || typeof entry.other !== 'string') return [];
  if (Object.keys(entry).some(key => !['zero', 'one', 'two', 'few', 'many', 'other'].includes(key))) return [];
  return Object.values(entry);
}
export function catalogueIssues(fr, en, reviewed) {
  const issues = [];
  for (const key of new Set([...Object.keys(fr), ...Object.keys(en), ...Object.keys(reviewed)])) {
    if (!Object.hasOwn(fr, key) || !Object.hasOwn(en, key)) {
      const reason = !Object.hasOwn(fr, key) && !Object.hasOwn(en, key) ? 'supprimer la référence de revue' : 'clé manquante dans un catalogue';
      issues.push(key + ' · ' + reason);
      continue;
    }
    const patterns = [...forms(fr[key]), ...forms(en[key])];
    if (!forms(fr[key]).length || !forms(en[key]).length || patterns.some(value => typeof value !== 'string' || !value.trim())) {
      issues.push(key + ' · texte vide ou pluriel sans forme other');
    } else if (patterns.some(value => placeholders(value) !== placeholders(patterns[0]))) {
      issues.push(key + ' · variables incompatibles');
    }
    if (reviewed[key] !== translationDigest(fr[key], en[key])) issues.push(key + ' · traduction à relire');
  }
  return issues;
}
export const translationDigest = (fr, en) => hash(JSON.stringify([fr, en]));
const readJson = name => JSON.parse(readFileSync(name, 'utf8'));
const writeJson = (name, data) => writeFileSync(name, JSON.stringify(data, null, 2) + '\n');

async function domainIssues(fr, en) {
  const issues = [];
  for (const [locale, messages] of [['fr', fr], ['en', en]]) {
    const files = readdirSync('src/ui/locales/' + locale).filter(file => file.endsWith('.js'));
    const seen = new Set();
    for (const file of files) {
      const { default: domain } = await import('../src/ui/locales/' + locale + '/' + file);
      for (const [key, value] of Object.entries(domain)) {
        if (seen.has(key)) issues.push(locale + '/' + file + ' · clé en double ' + key);
        if (!Object.hasOwn(messages, key) || messages[key] !== value) issues.push(locale + '/' + file + ' · clé absente du registre ' + key);
        seen.add(key);
      }
    }
  }
  return issues;
}

async function main(args) {
  const fr = locales.fr.messages, en = locales.en.messages;
  const reviewed = readJson(reviewPath);
  const baseline = readJson(debtPath);
  if (args[0] === '--review' && args.length > 1) {
    for (const key of args.slice(1)) {
      if (!Object.hasOwn(fr, key) && !Object.hasOwn(en, key)) delete reviewed[key];
      else if (Object.hasOwn(fr, key) && Object.hasOwn(en, key)) reviewed[key] = translationDigest(fr[key], en[key]);
      else throw Error('Renseigne FR et EN : ' + key);
    }
    writeJson(reviewPath, Object.fromEntries(Object.entries(reviewed).sort(([a], [b]) => a.localeCompare(b))));
    return;
  }

  const missingKeys = new Set();
  const protectedCopy = new Set();
  const current = inventory((key, file) => {
    if (!Object.hasOwn(fr, key) || !Object.hasOwn(en, key)) missingKeys.add(file + ' · clé inconnue : ' + key);
  }, (file, scope, copy) => protectedCopy.add(file + ' · ' + scope + ' · texte hors catalogue : ' + copy.slice(0, 160)));
  const added = newlyVisible(current, baseline);
  if (args[0] === '--list' && args.length === 1) {
    for (const [file, candidates] of Object.entries(current)) for (const copy of candidates) console.log(file + ' · ' + copy);
    return;
  }
  if (args[0] === '--prune' && args.length === 1 && !added.length && !protectedCopy.size) {
    const lines = Object.entries(inventoryHashes(current)).map(([file, ids]) => {
      const rows = [];
      for (let i = 0; i < ids.length; i += 6) rows.push('    ' + ids.slice(i, i + 6).map(id => JSON.stringify(id)).join(', '));
      return '  ' + JSON.stringify(file) + ': [\n' + rows.join(',\n') + '\n  ]';
    });
    writeFileSync(debtPath, '{\n' + lines.join(',\n') + '\n}\n');
    return;
  }
  if (args.length && (args.length !== 1 || args[0] !== '--prune')) throw Error('Usage: i18n-audit.mjs [--list | --prune | --review KEY...]');

  const issues = [...catalogueIssues(fr, en, reviewed), ...await domainIssues(fr, en), ...seasonalCatalogueIssues(), ...missingKeys, ...protectedCopy];
  const base = process.env.LUMEN_I18N_BASE;
  if (base) {
    if (!/^[a-f0-9]{40}$/.test(base)) throw Error('Invalid i18n comparison SHA');
    const target = spawnSync('git', ['ls-tree', base, '--', debtPath], { encoding: 'utf8' });
    if (target.status !== 0) throw Error('Cannot inspect the target revision for the i18n baseline');
    if (target.stdout.trim()) {
      const previous = spawnSync('git', ['show', base + ':' + debtPath], { encoding: 'utf8' });
      if (previous.status !== 0) throw Error('Cannot read the i18n baseline for the target revision');
      for (const { file } of newlyVisible(baseline, JSON.parse(previous.stdout), value => value)) {
        const issue = file + ' · le registre historique ne peut pas accepter de nouveaux textes';
        if (!issues.includes(issue)) issues.push(issue);
      }
    }
  }
  for (const { file, copy } of added) issues.push(file + ' · texte hors catalogue : ' + copy.slice(0, 160));
  if (issues.length) {
    console.error(issues.slice(0, 30).join('\n'));
    if (issues.length > 30) console.error('… ' + (issues.length - 30) + ' autres écarts');
    process.exitCode = 1;
  } else {
    const total = Object.values(current).reduce((sum, entries) => sum + entries.length, 0);
    console.log('i18n · ' + Object.keys(fr).length + ' clés FR/EN vérifiées · ' + total + ' occurrences historiques recensées');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv.slice(2));
