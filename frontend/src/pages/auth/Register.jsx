import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa6';
import { useAuth } from '../../context/AuthContext.jsx';
import AuthShell from './AuthShell.jsx';
import './AuthPage.css';

const Register = () => {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to create account.');
    }
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <h1>Create account</h1>
        <p>Register once, then join or create kitchens for shared bills.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Username
            <input autoComplete="username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
          </label>
          <label>
            Password
            <span className="auth-password-input">
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
              </button>
            </span>
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit">Create account</button>
        </form>
        <p>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default Register;
