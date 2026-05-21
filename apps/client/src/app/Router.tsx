import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>Dashboard</div>} />
          <Route path="exercises" element={<div>Exercise Library</div>} />
          <Route path="routines" element={<div>Routines</div>} />
          <Route path="routines/:id" element={<div>Routine Detail</div>} />
        </Route>
        <Route path="session" element={<div>Active Session</div>} />
      </Routes>
    </BrowserRouter>
  );
}
