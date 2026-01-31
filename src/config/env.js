export const env = {
    PORT: process.env.PORT ?? '3000',
  
    PGHOST: process.env.PGHOST,
    PGPORT: process.env.PGPORT ?? '5432',
    PGDATABASE: process.env.PGDATABASE,
    PGUSER: process.env.PGUSER,
    PGPASSWORD: process.env.PGPASSWORD,
  
    AIRWALLEX_ENV: process.env.AIRWALLEX_ENV ?? 'demo',
    AIRWALLEX_CLIENT_ID: process.env.AIRWALLEX_CLIENT_ID,
    AIRWALLEX_API_KEY: process.env.AIRWALLEX_API_KEY,
};
  