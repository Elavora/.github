'use strict';
const fs = require('node:fs');
const path = require('node:path');

function install(root, ref) {
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error('Use um SHA Git completo para automation_ref.');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'composer.json'), 'utf8'));
  if (!/^elavora\/api-[a-z0-9-]+$/.test(manifest.name)) throw new Error('Esperado um pacote Composer elavora/api-*.');
  const workflows = path.join(root, '.github', 'workflows');
  fs.mkdirSync(workflows, { recursive: true });
  const template = fs.readFileSync(path.join(__dirname, '..', 'templates', 'packagist-sync.yml'), 'utf8');
  fs.writeFileSync(path.join(workflows, 'packagist-sync.yml'), template.replaceAll('AUTOMATION_REF', ref));
  for (const legacy of ['publish-composer.yml', 'update-composer-on-release.yml']) {
    fs.rmSync(path.join(workflows, legacy), { force: true });
  }
}

module.exports = { install };
if (require.main === module) install(process.argv[2], process.argv[3]);
