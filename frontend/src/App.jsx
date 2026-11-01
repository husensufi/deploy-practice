import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import SignupPage from "./pages/auth/SignupPage.jsx";

const AssessmentPage = lazy(() => import("./pages/assessment/AssessmentPage.jsx"));
const ConnectionChatPage = lazy(() => import("./pages/connections/ConnectionChatPage.jsx"));
const ConnectionsPage = lazy(() => import("./pages/connections/ConnectionsPage.jsx"));
const DoctorProfilePage = lazy(() => import("./pages/doctors/DoctorProfilePage.jsx"));
const DoctorsPage = lazy(() => import("./pages/doctors/DoctorsPage.jsx"));
const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage.jsx"));
const TrackerPage = lazy(() => import("./pages/tracker/TrackerPage.jsx"));

export default function App() {
  return (
    <Suspense fallback={<p className="page-status" role="status">Loading page...</p>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/connections/:friendId/chat" element={<ConnectionChatPage />} />
            <Route element={<ProtectedRoute roles={["patient"]} />}>
              <Route path="/assessment" element={<AssessmentPage />} />
              <Route path="/tracker" element={<TrackerPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/doctors" element={<DoctorsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={["doctor"]} />}>
              <Route path="/doctor/profile" element={<DoctorProfilePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
}
