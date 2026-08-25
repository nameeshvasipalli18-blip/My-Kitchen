import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api.js';
import AuthShell from './AuthShell.jsx';
import './AuthPage.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to request a password reset.');
    }
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <h1>Reset your password</h1>
        <p>Enter your email and we will send a secure reset link.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button type="submit">Send reset link</button>
        </form>
        <p>Remembered it? <Link to="/login">Log in</Link></p>
      </div>
    </AuthShell>
  );
};

export default ForgotPassword;