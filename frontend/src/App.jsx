import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Offices from './pages/Offices';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Hardware from './pages/Hardware';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/offices" element={<Offices />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:id" element={<RoomDetail />} />
        <Route path="/hardware" element={<Hardware />} />
      </Routes>
    </Layout>
  );
}
