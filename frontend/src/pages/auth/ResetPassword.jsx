import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa6';
import api from '../../api.js';
import AuthShell from './AuthShell.jsx';
import './AuthPage.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
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
            <span className="auth-password-input">
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
              </button>
            </span>
          </label>
          <label>
            Confirm new password
            <span className="auth-password-input">
              <input type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" minLength="8" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmation((visible) => !visible)} aria-label={showConfirmation ? 'Hide password' : 'Show password'} title={showConfirmation ? 'Hide password' : 'Show password'}>
                {showConfirmation ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
              </button>
            </span>
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