import { Routes, Route } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Offices from './pages/Offices';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Hardware from './pages/Hardware';
import Settings from './pages/Settings';

export default function App() {
  const { user, ready } = useAuth();

  if (!ready) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/offices" element={<Offices />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:id" element={<RoomDetail />} />
        <Route path="/hardware" element={<Hardware />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
