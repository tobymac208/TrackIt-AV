import { Navigate, Routes, Route } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Offices from './pages/Offices';
import JobSites from './pages/JobSites';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Hardware from './pages/Hardware';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import SettingsAccounts from './pages/SettingsAccounts';
import SettingsMfa from './pages/SettingsMfa';
import SettingsTheme from './pages/SettingsTheme';
import SetupAccount from './pages/SetupAccount';

export default function App() {
  const { user, ready, can } = useAuth();

  if (!ready) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    );
  }

  if (user.setupOnly) {
    return <SetupAccount />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/offices" element={can('offices', 'read') ? <Offices /> : <Navigate to="/" replace />} />
        <Route path="/jobsites" element={can('rooms', 'read') ? <JobSites /> : <Navigate to="/" replace />} />
        <Route path="/rooms" element={can('rooms', 'read') ? <Rooms /> : <Navigate to="/" replace />} />
        <Route path="/rooms/:id" element={can('rooms', 'read') ? <RoomDetail /> : <Navigate to="/" replace />} />
        <Route path="/hardware" element={can('hardware', 'read') ? <Hardware /> : <Navigate to="/" replace />} />
        <Route path="/inventory" element={can('inventory', 'read') ? <Inventory /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={<Settings />}>
          <Route index element={<Navigate to="accounts" replace />} />
          <Route path="accounts" element={<SettingsAccounts />} />
          <Route path="mfa" element={<SettingsMfa />} />
          <Route path="theme" element={<SettingsTheme />} />
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
