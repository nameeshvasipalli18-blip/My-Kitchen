# Backend Configuration

## Local development

From the project root, create a virtual environment and install the backend dependencies:

```bash
python3 -m venv backend/venv
backend/venv/bin/python -m pip install -r backend/requirements.txt
cd backend
source venv/bin/activate
python -m fastapi dev main.py
```

The API runs at http://127.0.0.1:8000 and its interactive documentation is at
http://127.0.0.1:8000/docs. The default local database is SQLite and is created
automatically; PostgreSQL is optional via `MY_KITCHEN_DATABASE_URL`.

Use the activated virtual environment so the command runs the project's installed
dependencies instead of the system FastAPI package. `fastapi[standard]` includes
the CLI dependencies required by `fastapi dev`.

In a separate terminal, start the frontend from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Password reset email with Brevo

The existing `/auth/forgot-password` and `/auth/reset-password` routes support
Brevo transactional templates. Reset tokens are stored as hashes, expire after
30 minutes, and can only be used once. A successful reset revokes existing login
sessions. Unknown email addresses receive the same success message.

For local development, copy `.env.example` to `.env` in `backend/` and fill in
the Brevo settings. No SMTP settings are needed when using Brevo.

### Brevo template

Activate your transactional template in Brevo, verify the sender, and set the
reset button URL to `{{ params.RESET_LINK }}`. The application sends the full
reset URL in `params.RESET_LINK`. The sender address must match a verified
sender in your Brevo account. Use the actual numeric template ID.

The API endpoint is `https://api.brevo.com/v3/smtp/email`, not `https://brevo.com`.
See [Brevo's transactional email API](https://developers.brevo.com/reference/send-transac-email).

### Production environment variables

For the current deployment, use these values in the backend Vercel project
(`my-kitchen-i2rp`):

```text
FRONTEND_URL=https://my-kitchen-lilac.vercel.app
BREVO_SENDER_EMAIL=vamsijvk0337@gmail.com
BREVO_SENDER_NAME=Kitchen split
```

Also add the private `BREVO_API_KEY`, numeric `BREVO_TEMPLATE_ID`, and existing
persistent `MY_KITCHEN_DATABASE_URL`. The Brevo template share URL is not a
numeric template ID. `frontend/.env.production` points production builds to
`https://my-kitchen-i2rp.vercel.app`; a `VITE_API_URL` set in Vercel overrides it.
Redeploy both projects after the updated code and settings are ready.

Set these on the service running **FastAPI**. If your backend runs on Vercel,
use its project Settings → Environment Variables and select Production (and
Preview if needed):

| Variable | Value |
| --- | --- |
| `BREVO_API_KEY` | Your private Brevo API key |
| `BREVO_TEMPLATE_ID` | Your active template's numeric ID |
| `BREVO_SENDER_EMAIL` | Your verified sender email |
| `BREVO_SENDER_NAME` | `Kitchen split` (optional) |
| `FRONTEND_URL` | Your full frontend origin, e.g. `https://your-project.vercel.app` |
| `MY_KITCHEN_DATABASE_URL` | Your persistent PostgreSQL connection string |

`FRONTEND_URL` is used for both CORS and reset links. The reset page defaults to
`${FRONTEND_URL}/reset-password`; `PASSWORD_RESET_URL` can override the complete
reset page URL. `VERCEL_FRONTEND_URL` is also accepted for reset links, but prefer
`FRONTEND_URL` so CORS is configured too. Use a stable frontend URL rather than
an automatically changing preview deployment URL. Without any URL configuration,
links use `http://localhost:5173/reset-password` for local development.

Never prefix the Brevo API key with `VITE_` or put it in frontend code.
Redeploy after changing Vercel environment variables; existing deployments do
not pick up changes automatically. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

### Frontend and backend deployment

This repository's `frontend/vercel.json` serves the React application. Its `/api`
proxy in `vite.config.js` is only active during local development. If the API is
hosted separately, set `VITE_API_URL=https://your-backend-host` in the **frontend**
Vercel project and redeploy. The backend routes start with `/auth`, so do not
append `/api` unless your backend deployment explicitly uses that prefix.

To host FastAPI on Vercel as a separate project, set that project's Root Directory
to `backend`; its `main.py` exports the app. Configure the backend variables above
before deploying. A persistent external database is required for accounts and
reset tokens; the local SQLite file is for local development and is not suitable
for Vercel Functions. See [Vercel's FastAPI deployment guide](https://vercel.com/docs/frameworks/backend/fastapi).

### Verify after deployment

1. Create an account in the deployed application, or use an existing account.
2. Open `/forgot-password` and submit that account's email.
3. Check Brevo transactional logs and your inbox/spam folder.
4. Open the email link and choose a new password.
5. Confirm the new password works, the old password fails, and the reset link
   cannot be used twice.

Brevo delivery/network failures return a generic 503 response without exposing
provider response bodies or API keys. If any Brevo setting is present, all
required Brevo settings must be valid; incomplete settings do not fall back to SMTP.

### Optional SMTP fallback

When no Brevo settings are set, the existing SMTP transport remains available:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM=no-reply@example.com
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_USE_TLS=true
```

For Gmail SMTP, use an App Password rather than your normal Gmail password.

Run backend password reset checks from the project root:

```bash
backend/venv/bin/python -m unittest discover -s backend/tests -v
```
