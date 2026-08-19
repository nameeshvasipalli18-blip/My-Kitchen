import { Routes, Route } from 'react-router-dom';
import Home from '../pages/home page/Home.jsx';
import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';
import Dashboard from '../pages/dashboard/Dashboard.jsx';
import ManualSplit from '../pages/manual split/ManualSplit.jsx';
import ProtectedRoute from '../components/auth/ProtectedRoute.jsx';

const App = () => {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/manual-split/:kitchenId" element={<ManualSplit />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;
