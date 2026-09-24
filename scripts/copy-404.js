import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const indexFile = path.join(distDir, 'index.html');
const notFoundFile = path.join(distDir, '404.html');

try {
  if (fs.existsSync(indexFile)) {
    fs.copyFileSync(indexFile, notFoundFile);
    console.log('Successfully generated dist/404.html for GitHub Pages SPA routing fallback.');
  }
} catch (err) {
  console.warn('Could not copy 404.html:', err);
}
