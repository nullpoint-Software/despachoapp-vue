// generate-htaccess.js
import { writeFile } from 'fs/promises';

const htaccessContent = `
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`.trim();

try {
  await writeFile('./dist/.htaccess', htaccessContent, 'utf8');
  console.log('.htaccess file generated in /dist ✅');
} catch (error) {
  console.error('❌ Failed to write .htaccess file:', error);
}
