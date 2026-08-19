# Metrivo Security Model

## Current privacy boundary

Metrivo is a hardened confidential SaaS application. The Next.js and Python services are trusted to process plaintext transaction data so that classification, analytics, forecasting, anomalies, and AI tool calls continue to work.

This release does **not** claim zero-knowledge or end-to-end encryption. Strict zero knowledge requires parsing and analytics to run on the user's device and is tracked as a separate architecture project.

The external analyst provider receives the user's question, recent conversation context, business profile, and only the aggregate results returned by Metrivo's bounded analyst tools. Raw uploaded files are not retained and raw transactions are not directly exposed as an analyst tool.

## Authentication and sessions

- Access tokens expire after 15 minutes.
- Refresh tokens expire after 30 days, are single-use, and rotate on refresh.
- Only SHA-256 refresh-token hashes are stored in MongoDB.
- Refresh-token reuse revokes the complete token family.
- Production cookies use `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and the `__Host-` prefix.
- State-changing API requests require a same-origin custom request header and reject cross-site Fetch Metadata.
- Login, registration, refresh, upload, recalculation, reclassification, and analyst requests are rate limited.

## Internal analytics service

The Python service has no browser CORS access. In production, set `METRIVO_ENV=production` and configure the same independent `ANALYTICS_SERVICE_TOKEN` for both services. Run the Python service on a private interface or private network; do not expose port 8000 publicly.

## Upload handling

- Raw files are processed in memory and discarded.
- Only CSV, XLSX, and XLS extensions are accepted.
- Spreadsheet signatures, file size, filename length, binary CSV content, and transaction count are validated.
- Parsed transaction records are business scoped and deduplicated using a unique business/key index.

## Production deployment checklist

- Use independent random values of at least 32 characters for `JWT_SECRET` and `ANALYTICS_SERVICE_TOKEN`.
- Do not run the demo seed in production; remove any existing demo account before launch.
- Require HTTPS at the edge and keep MongoDB and Python on private networks.
- Enable authenticated, encrypted MongoDB connections and encrypted backups.
- Configure request-body limits at the reverse proxy in addition to application checks.
- Restrict production logs and monitoring from recording uploaded rows, chat content, cookies, or provider credentials.
- Test backup restoration, tenant isolation, refresh-token replay, deletion, and provider-failure behavior before launch.
- Review the AI provider's retention, training, region, and data-processing terms.

## Reporting a vulnerability

Do not include real customer data, credentials, or session tokens in a report. Provide a minimal reproduction and the affected route or component through the project's private security contact.
