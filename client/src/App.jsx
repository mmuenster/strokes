import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import RoundDetail from './pages/RoundDetail.jsx';
import RoundSummary from './pages/RoundSummary.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rounds/:id" element={<RoundDetail />} />
      <Route path="/rounds/:id/summary" element={<RoundSummary />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
