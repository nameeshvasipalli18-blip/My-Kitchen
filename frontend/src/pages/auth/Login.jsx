import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import AuthShell from './AuthShell.jsx';
import './AuthPage.css';

const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await login(identifier, password, keepSignedIn);
      const nextPath = location.state?.from?.pathname || '/dashboard';
      navigate(nextPath, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to log in.');
    }
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Log in to manage your kitchens and shared bills.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email or username
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="auth-remember-me">
            <input type="checkbox" checked={keepSignedIn} onChange={(event) => setKeepSignedIn(event.target.checked)} />
            <span>Keep me signed in</span>
          </label>
          <Link className="auth-inline-link" to="/forgot-password">Forgot password?</Link>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit">Log in</button>
        </form>
        <p>
          Need an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default Login;
