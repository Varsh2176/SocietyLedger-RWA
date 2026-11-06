# SocietyLedger Vercel deployment

This is the setup procedure for the single Vercel project. It does not deploy the application, create an Atlas user, or initialize production data. Render configuration in `render.yaml` stays in place for the existing Render services.

The frontend and API ship together. Vercel Services is in beta. The browser uses one origin, so the production session cookie is `Secure` and `SameSite=Lax`.

## Project

1. Import `https://github.com/Varsh2176/SocietyLedger-RWA` as one Vercel project.
2. Leave the project root at the repository root. Do not set the root directory to `frontend` or `backend`. `vercel.json` defines both services.
3. Framework detection comes from `vercel.json`:
   - `web` builds `frontend` with Vite and rewrites every path to `index.html`, so React Router routes survive a refresh.
   - `api` runs `backend/api/index.js` as Express. It exports the app and does not call `listen`.
4. Public routing sends `/api/*` to the API service first, then every other path to the site.
5. The API function region is `bom1` (Mumbai), next to an Atlas cluster in `ap-south-1`.

`npm start` in `backend` remains the local and Render process. Vercel does not use that listener.

## Environment variables

Enter these in the Vercel project. Do not commit real values, and do not paste connection strings or passwords into chat or into Git.

API service (`backend`):

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas SRV URI whose path is `society_ledger` |
| `JWT_SECRET` | Long random value generated in Vercel. Do not use the example placeholder. |
| `COOKIE_SECRET` | A different long random value. |
| `JWT_EXPIRES_IN` | `1d` |
| `CLIENT_URL` | Exact site origin, `https://…`, with no path and no trailing slash |
| `BLOB_STORE_ID` | Injected when a private Blob store is connected |

`BLOB_READ_WRITE_TOKEN` is only for a private store that is not using Vercel OIDC. Leave it unset when `BLOB_STORE_ID` is connected. Production refuses to start until one of those Blob values is present. It also refuses a missing database name, a database other than `society_ledger`, and development JWT or cookie secrets.

Do not set `UPLOADS_DIR` on Vercel. Production document storage does not use the local disk. Render still uses `UPLOADS_DIR=/var/data/uploads`.

Web service (`frontend`), available at build time:

| Name | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `/api` |
| `VITE_ENABLE_MOCK_FALLBACK` | `false` |

`/api` keeps preview deployments on their own host. A production build fails when this value is missing or points at `localhost` or `127.0.0.1`.

## Atlas

Use the existing MongoDB Atlas cluster in Mumbai (`ap-south-1`). Do not create a second database.

1. Database Access: create an application user with `readWrite` on `society_ledger` only. Do not use the Atlas organization owner.
2. Give that user no cluster administration privilege.
3. Network Access: Vercel Functions do not have one stable outbound address on standard plans. Until a static egress address is available, Atlas must allow the addresses Vercel actually uses. A temporary `0.0.0.0/0` rule is a known limitation, not the preferred end state.
4. Connection string: copy the SRV URI in the Atlas console and set the path to `/society_ledger`. Store it only as `MONGODB_URI` in Vercel.
5. After the API is running, `GET /api/health` must show `database.name` of `society_ledger` and `database.status` of `connected`.

## Private documents

Create a private Blob store and connect it to this project:

```bash
vercel blob create-store societyledger-documents --access private --yes
```

Private Blob URLs are not publicly readable. The API authenticates the user, checks the society and role, then streams the object with `get(pathname, { access: 'private' })`. Clients receive `/api/documents/:id/download` only. Production does not write `backend/uploads` when Blob is unavailable.

Local development continues to store files under `backend/uploads` or `UPLOADS_DIR`. Do not copy demo files into the private store.

Production uploads are limited to 3 MB because a Vercel function body cannot exceed 4.5 MB and the JSON payload is base64. Local development and Render keep the 10 MB application limit.

## Deploy

1. Confirm the variables above are set for Production and Preview.
2. Deploy the Git branch from the Vercel dashboard, or with the Vercel CLI from a linked checkout: `vercel --prod` only after you have reviewed the preview.
3. Do not add `npm run seed` or `npm run bootstrap:production` to the build command.
4. Open `https://<site>/api/health`. The database name must be `society_ledger`.
5. Open a client route such as `/login` and refresh it. The site must return the React app, not a Vercel 404.

## Production bootstrap

Do this once, from a trusted machine, and only after an explicit decision to create the production society. The command does not read `backend/.env`. It does not import local users, funds, transactions, documents, or reconciliations.

From `backend`:

```bash
$env:NODE_ENV = 'production'
$env:BOOTSTRAP_CONFIRM = 'INITIALIZE_GREENWOOD_HEIGHTS'
$env:CONFIRM_ATLAS_INIT = 'YES'
$env:MONGODB_URI = '<Atlas SRV URI with path /society_ledger>'
$env:BOOTSTRAP_ADMIN_NAME = '<administrator name>'
$env:BOOTSTRAP_ADMIN_EMAIL = '<administrator email>'
$env:BOOTSTRAP_ADMIN_PASSWORD = '<at least 12 characters, not a development password>'
npm run bootstrap:production
```

The email must not be one of the demo `@society.org` accounts. On Windows, set the variables in the same terminal session and do not echo them. A second run keeps the existing society, invitation code, administrator, and password. The command prints the invitation code once. Store that code outside Git and outside public logs.

Leave `ALLOW_LOCAL_LEDGER_INIT` unset. Never run `npm run seed` against Atlas.

## Verification

- `GET /api/health` returns HTTP 200 and `database.status` of `connected`.
- Sign in as the bootstrapped Society Administrator and land on the administrator dashboard.
- Register a resident with the new invitation code. The account stays a Resident and verification stays pending.
- Open `/resident-portal` directly and refresh. The route still loads.
- Upload a small PDF as an administrator. The response must not contain a `vercel-storage.com` URL. Download it through `/api/documents/:id/download` while signed in. An anonymous request receives 401.
- Confirm the browser calls `/api` on the same host and does not show sample financial figures.

## Troubleshooting

- API process exits during a manual `node api/index.js` run: the message names the missing variable and does not print the secret. Set that variable in Vercel.
- Health shows a database other than `society_ledger`: the URI path is wrong. Change it in Vercel and redeploy. Do not point the URI at `admin` or `test`.
- Browser login succeeds and the next request is unauthenticated: `CLIENT_URL` does not match the site origin exactly, or the site was built with an API host other than `/api`.
- Document upload returns 503: the private Blob store is not connected, or the store is public. Recreate it with private access.
- Document upload returns 413: the file plus base64 exceeded the 4.5 MB function body limit. Use a file of 3 MB or smaller.
- Deep links 404: the `web` service rewrite to `/index.html` is missing. The API rewrite must stay first.

## Rollback

Promote the previous Vercel deployment from the project’s deployment list. Rolling back the deployment does not undo Atlas writes or delete Blob objects. Restore Atlas from its backup if a later bootstrap or migration changes data. Blob objects remain until they are deleted through an authorized API call.

Local development and the Render blueprint are independent. A Vercel rollback does not change Render.
