# Performance Styling agreement app

This package is intended to replace the source files in the Shopify React Router app already linked to Performance Styling Collaborat.

## After copying the files

Open PowerShell in the Shopify app root and run:

```powershell
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma migrate deploy
shopify.cmd app config validate --json
shopify.cmd app deploy
shopify.cmd app dev
```

Approve the requested `write_app_proxy` permission if Shopify asks. Keep the final `shopify app dev` process running while testing.

## Test flow

1. Open the app in the dev store.
2. Select **Create agreement**.
3. Save the private storefront path and the one-time six-digit PIN.
4. Open `https://performance-styling-app-test.myshopify.com` followed by that path.
5. Enter the PIN and sign as the creator.
6. Return to the app in Shopify admin, select the creator, and add the company signature.
7. Select **Print signed copy** and choose **Save as PDF**.

The included SQLite database is suitable for local development. Before a permanent production deployment, configure a hosted persistent SQL database and add PIN attempt rate limiting.
