import os
import sys
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import httpx
from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core import email as mail
from app.core.security import hash_password, hash_token, verify_password
from app.models import AuthTokenTable, PasswordResetTokenTable, UserTable, utc_now
from app.routers import auth
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest

BREVO_ENV = {
    'BREVO_API_KEY': 'test-private-key',
    'BREVO_TEMPLATE_ID': '42',
    'BREVO_SENDER_EMAIL': 'sender@example.com',
    'FRONTEND_URL': 'https://kitchen.example.com',
}


class EmailTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, BREVO_ENV, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_brevo_template_request(self):
        with patch.object(mail.httpx, 'Client') as factory:
            client = factory.return_value.__enter__.return_value
            client.post.return_value = httpx.Response(201)
            self.assertTrue(mail.send_password_reset_email('user@example.com', 'secret-token'))
            args, kwargs = client.post.call_args
            self.assertEqual(args[0], 'https://api.brevo.com/v3/smtp/email')
            self.assertEqual(kwargs['headers']['api-key'], 'test-private-key')
            self.assertEqual(kwargs['json']['templateId'], 42)
            self.assertEqual(kwargs['json']['to'], [{'email': 'user@example.com'}])
            self.assertEqual(kwargs['json']['sender']['email'], 'sender@example.com')
            self.assertEqual(kwargs['json']['params']['RESET_LINK'],
                             'https://kitchen.example.com/reset-password?token=secret-token')
            factory.assert_called_once_with(timeout=10)

    def test_provider_failure_does_not_expose_response(self):
        with patch.object(mail.httpx, 'Client') as factory:
            factory.return_value.__enter__.return_value.post.return_value = httpx.Response(400, text='sensitive-provider-body')
            with self.assertRaises(mail.PasswordResetEmailError) as caught:
                mail.send_password_reset_email('user@example.com', 'secret-token')
            self.assertNotIn('sensitive-provider-body', str(caught.exception))

    def test_timeout_is_delivery_error(self):
        with patch.object(mail.httpx, 'Client') as factory:
            factory.return_value.__enter__.return_value.post.side_effect = httpx.ReadTimeout('timeout')
            with self.assertRaises(mail.PasswordResetEmailError):
                mail.send_password_reset_email('user@example.com', 'secret-token')

    def test_provider_code_is_safe_to_log(self):
        with patch.object(mail.httpx, 'Client') as factory:
            client = factory.return_value.__enter__.return_value
            client.post.return_value = httpx.Response(401, json={'code': 'unauthorized', 'message': 'sensitive-provider-body'})
            with self.assertRaises(mail.PasswordResetEmailError) as caught:
                mail.send_password_reset_email('user@example.com', 'secret-token')
            self.assertIn('code=unauthorized', str(caught.exception))
            self.assertNotIn('sensitive-provider-body', str(caught.exception))

    def test_incomplete_brevo_config_does_not_use_smtp(self):
        for template_id in ['', 'invalid', '0', '-1']:
            with self.subTest(template_id=template_id), patch.dict(os.environ, {'BREVO_TEMPLATE_ID': template_id, 'SMTP_HOST': 'smtp.example.com', 'SMTP_FROM': 'sender@example.com'}):
                self.assertFalse(mail.is_password_reset_email_configured())

    def test_reset_url_override_preserves_query_and_replaces_token(self):
        with patch.dict(os.environ, {'PASSWORD_RESET_URL': 'https://kitchen.example.com/reset-password?source=email&token=old'}):
            url = mail._password_reset_link('a+b/c')
            self.assertEqual(parse_qs(urlsplit(url).query), {'source': ['email'], 'token': ['a+b/c']})

    def test_smtp_fallback(self):
        with patch.dict(os.environ, {'SMTP_HOST': 'smtp.example.com', 'SMTP_FROM': 'sender@example.com'}, clear=True), patch.object(mail.smtplib, 'SMTP') as smtp:
            self.assertTrue(mail.send_password_reset_email('user@example.com', 'token'))
            smtp.return_value.__enter__.return_value.send_message.assert_called_once()


class ResetFlowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.session.close)
        self.env = patch.dict(os.environ, BREVO_ENV, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.user = UserTable(email='user@example.com', username='test-user', password_hash=hash_password('original-password'))
        self.session.add(self.user)
        self.session.commit()

    def request_reset(self):
        with patch.object(auth, 'send_password_reset_email') as send:
            result = auth.forgot_password(ForgotPasswordRequest(email=self.user.email), self.session)
            return result, send.call_args.args[1]

    def test_unknown_email_has_same_message_and_no_email(self):
        expected, _ = self.request_reset()
        with patch.object(auth, 'send_password_reset_email') as send:
            result = auth.forgot_password(ForgotPasswordRequest(email='unknown@example.com'), self.session)
            self.assertEqual(result, expected)
            send.assert_not_called()

    def test_reset_is_single_use_and_revokes_sessions(self):
        self.session.add(AuthTokenTable(user_id=self.user.id, token_hash=hash_token('login-token'), expires_at=utc_now() + timedelta(days=1)))
        self.session.commit()
        _, token = self.request_reset()
        stored = self.session.exec(select(PasswordResetTokenTable)).one()
        self.assertEqual(stored.token_hash, hash_token(token))
        self.assertNotEqual(stored.token_hash, token)
        auth.reset_password(ResetPasswordRequest(token=token, password='new-password'), self.session)
        self.session.refresh(self.user)
        self.assertTrue(verify_password('new-password', self.user.password_hash))
        self.assertFalse(verify_password('original-password', self.user.password_hash))
        self.assertIsNotNone(self.session.exec(select(AuthTokenTable)).one().revoked_at)
        with self.assertRaises(HTTPException) as caught:
            auth.reset_password(ResetPasswordRequest(token=token, password='another-password'), self.session)
        self.assertEqual(caught.exception.status_code, 400)

    def test_new_request_invalidates_previous_token_and_expired_tokens_fail(self):
        _, first = self.request_reset()
        _, second = self.request_reset()
        with self.assertRaises(HTTPException):
            auth.reset_password(ResetPasswordRequest(token=first, password='new-password'), self.session)
        stored = self.session.exec(select(PasswordResetTokenTable).where(PasswordResetTokenTable.token_hash == hash_token(second))).one()
        stored.expires_at = utc_now() - timedelta(minutes=1)
        self.session.add(stored)
        self.session.commit()
        with self.assertRaises(HTTPException):
            auth.reset_password(ResetPasswordRequest(token=second, password='new-password'), self.session)

    def test_delivery_failure_returns_generic_503(self):
        with self.assertLogs(auth.logger, level='ERROR') as logs, patch.object(auth, 'send_password_reset_email', side_effect=mail.PasswordResetEmailError('Brevo rejected email (HTTP 401)')):
            with self.assertRaises(HTTPException) as caught:
                auth.forgot_password(ForgotPasswordRequest(email=self.user.email), self.session)
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail, 'Unable to send password reset email')
        self.assertIn('Brevo rejected email (HTTP 401)', logs.output[0])
        self.assertNotIn(BREVO_ENV['BREVO_API_KEY'], logs.output[0])


if __name__ == '__main__':
    unittest.main()
