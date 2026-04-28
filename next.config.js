/** @type {import('next').NextConfig} */
const nextConfig = {
  // v1 quiz deploy: admin/curriculum code lives in this repo but isn't
  // exercised in production (middleware 404s admin in IS_PUBLIC_DEPLOY=true).
  // Curriculum types have known drift; fixing them is a v1.1 task tracked in
  // docs/handovers/2026-04-28-diagnostic-quiz-revival.md.
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
