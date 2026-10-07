export default function robots() {
    return {
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: [ '/anime/', '/api/' ],
      },
      sitemap: 'https://kage-puce-beta.vercel.app/sitemap.xml',
    }
  }