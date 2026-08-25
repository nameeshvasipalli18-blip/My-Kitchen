import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api.js';
import AuthShell from './AuthShell.jsx';
import './AuthPage.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This password reset link is invalid or has expired.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    try {
      const response = await api.post('/auth/reset-password', { token, password });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to reset your password.');
    }
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <h1>Choose a new password</h1>
        <p>Your new password must be at least 8 characters.</p>
        <form onSubmit={handleSubmit}>
          <label>
            New password
            <input type="password" autoComplete="new-password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            Confirm new password
            <input type="password" autoComplete="new-password" minLength="8" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button type="submit" disabled={Boolean(message)}>Reset password</button>
        </form>
        <p><Link to="/login">Back to log in</Link></p>
      </div>
    </AuthShell>
  );
};

export default ResetPassword;