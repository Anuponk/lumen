import fs from 'node:fs';

const required = [
  ['AGENTS.md', 'Cloud persistence — blocking invariant'],
  ['docs/DATA_AND_ARCHITECTURE.md', 'Cloud persistence contract'],
  ['docs/TESTING.md', 'Cloud persistence regression matrix'],
  ['docs/RELEASE.md', 'Cloud persistence release blocker'],
  ['.github/pull_request_template.md', 'Cloud persistence impact'],
];
let failed = false;
for (const [file, phrase] of required) {
  const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (!content.includes(phrase)) {
    console.error('Missing persistence contract in ' + file + ': ' + phrase);
    failed = true;
  }
}
const eventPath = process.env.GITHUB_EVENT_PATH;
if (eventPath && fs.existsSync(eventPath)) {
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  if (event.pull_request) {
    const body = event.pull_request.body || '';
    for (const heading of ['Cloud persistence impact', 'Impact / justification:', 'Tests executed / results:', 'Migration / rollback / cloud restore:']) {
      if (!body.includes(heading)) {
        console.error('PR must include: ' + heading);
        failed = true;
      }
    }
    for (const label of ['Impact / justification:', 'Tests executed / results:', 'Migration / rollback / cloud restore:']) {
      const line = body.split(label)[1]?.split('\n').find((s) => s.trim() && !s.trim().startsWith('<!--'))?.trim();
      if (!line || line.startsWith('**') || line.startsWith('##')) {
        console.error('PR section needs explicit content: ' + label);
        failed = true;
      }
    }
  }
}
if (failed) process.exit(1);
console.log('Cloud persistence policy / PR contract verified. This check does not test runtime persistence.');
