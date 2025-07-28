// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  // devtools: { enabled: true }
  css: ["~/assets/css/main.css"],
  ssr: false,
  runtimeConfig: {
    dbUser: process.env.DB_USER,
    dbHost: process.env.DB_HOST,
    dbName: process.env.DB_NAME,
    dbPassword: process.env.DB_PASSWORD,
    dbPort: process.env.DB_PORT,
  },
});
