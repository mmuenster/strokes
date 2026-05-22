import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import RoundDetail from './pages/RoundDetail.jsx';
import RoundSummary from './pages/RoundSummary.jsx';
import MultiRoundSummary from './pages/MultiRoundSummary.jsx';
import AddCourse from './pages/AddCourse.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rounds/:id" element={<RoundDetail />} />
      <Route path="/rounds/:id/summary" element={<RoundSummary />} />
      <Route path="/multi-summary" element={<MultiRoundSummary />} />
      <Route path="/courses/new" element={<AddCourse />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
