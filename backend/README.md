# Backend Configuration

## Password reset email

Copy `.env.example` to `.env`, then configure these values before starting the API:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM=no-reply@example.com
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_USE_TLS=true
PASSWORD_RESET_URL=http://localhost:5173/reset-password
```

`PASSWORD_RESET_URL` is optional and defaults to the local frontend reset page. Reset links expire after 30 minutes and can only be used once.

For Gmail, enable two-step verification and create an App Password. Use that App Password for `SMTP_PASSWORD`; your normal Gmail password will not work.