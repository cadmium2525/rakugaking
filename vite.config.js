import { defineConfig } from 'vite';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'rakuga-offline',
      apply: 'build',
      async closeBundle() {
        const root = resolve('dist');
        const files = (await readdir(root, { recursive: true, withFileTypes: true }))
          .filter((entry) => entry.isFile() && entry.name !== 'sw.js')
          .map((entry) =>
            relative(root, resolve(entry.parentPath, entry.name)).replaceAll('\\', '/'),
          )
          .sort();
        const template = await readFile('src/service-worker.js', 'utf8');
        const hash = createHash('sha256').update(template);
        for (const file of files) hash.update(file).update(await readFile(resolve(root, file)));
        const source = template
          .replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 16))
          .replace(
            '__PRECACHE_FILES__',
            JSON.stringify(['./', ...files.map((file) => './' + file)]),
          );
        await writeFile(resolve(root, 'sw.js'), source);
      },
    },
  ],
});
