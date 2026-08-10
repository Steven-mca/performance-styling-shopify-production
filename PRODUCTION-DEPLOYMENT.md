# Production deployment target

Live Shopify store: `performance-styling-online.myshopify.com`

This production package uses PostgreSQL through the `DATABASE_URL` environment variable. It must not be copied over the local SQLite development project.

Required production environment variables:

- `DATABASE_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `NODE_ENV=production`
- `SCOPES=write_app_proxy`

The final `SHOPIFY_APP_URL`, `application_url`, and authentication callback URL are set after Render assigns the permanent service URL.
