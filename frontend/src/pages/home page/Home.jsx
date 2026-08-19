import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import './Home.css';

const Home = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="home-container"><div className="home-content"><p className="head">Loading…</p></div></div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="home-container">
      <div className="home-content">
        <p className="head">Welcome to the Kitchen Split!</p>
        <p className="tagline">Shared kitchens, shared bills, private accounts.</p>
      </div>
      <div className="button-container">
        <Link className="split-button" to="/login">Log in</Link>
        <Link className="split-button" to="/register">Create account</Link>
      </div>
    </div>
  );
};

export default Home;
