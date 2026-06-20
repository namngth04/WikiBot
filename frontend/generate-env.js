const fs = require('fs');

console.log('Starting runtime environment generator for Next.js...');

// Lấy tất cả biến môi trường bắt đầu bằng NEXT_PUBLIC_
const env = {};
for (const key in process.env) {
  if (key.startsWith('NEXT_PUBLIC_')) {
    env[key] = process.env[key];
  }
}

// Luôn đảm bảo có fallback cho API URL
if (!env.NEXT_PUBLIC_API_URL) {
  env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
}

const content = `// Generated at runtime
window.__ENV__ = ${JSON.stringify(env, null, 2)};
`;

try {
  // Ghi tệp vào thư mục public của Next.js
  fs.writeFileSync('./public/env-config.js', content);
  console.log('✅ Generated public/env-config.js successfully with variables:', env);
} catch (error) {
  console.error('❌ Failed to generate public/env-config.js:', error.message);
  process.exit(1);
}
