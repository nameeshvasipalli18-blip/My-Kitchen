import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [kitchens, setKitchens] = useState([]);
  const [kitchenName, setKitchenName] = useState('');
  const [error, setError] = useState('');

  const loadKitchens = async () => {
    try {
      const response = await api.get('/kitchens');
      setKitchens(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to load kitchens.');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadKitchens();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateKitchen = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post('/kitchens', { name: kitchenName });
      setKitchenName('');
      await loadKitchens();
      navigate(`/manual-split/${response.data.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to create kitchen.');
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <h1>Hello, {user?.username}</h1>
            <p>Choose a kitchen or create a new shared space.</p>
          </div>
          <button type="button" onClick={logout}>Log out</button>
        </header>

        <section className="dashboard-card">
          <h2>Create a kitchen</h2>
          <form onSubmit={handleCreateKitchen}>
            <input value={kitchenName} placeholder="Kitchen name" onChange={(event) => setKitchenName(event.target.value)} />
            <button type="submit">Create kitchen</button>
          </form>
          {error && <p className="dashboard-error">{error}</p>}
        </section>

        <section className="dashboard-card">
          <h2>Your kitchens</h2>
          <div className="kitchen-grid">
            {kitchens.map((kitchen) => (
              <article className="kitchen-card" key={kitchen.id}>
                <h3>{kitchen.name}</h3>
                <p className="kitchen-meta">Role: {kitchen.role}</p>
                <p className="kitchen-meta">Members: {kitchen.memberCount}</p>
                <button type="button" onClick={() => navigate(`/manual-split/${kitchen.id}`)}>
                  Open bills
                </button>
              </article>
            ))}
            {kitchens.length === 0 && <p>No kitchens yet. Create one to start splitting bills.</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
