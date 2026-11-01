import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import SignupPage from "./pages/auth/SignupPage.jsx";

const AssessmentPage = lazy(() => import("./pages/assessment/AssessmentPage.jsx"));
const AdminAppointmentsPage = lazy(() => import("./pages/appointments/AdminAppointmentsPage.jsx"));
const DoctorAppointmentsPage = lazy(() => import("./pages/appointments/DoctorAppointmentsPage.jsx"));
const PatientAppointmentsPage = lazy(() => import("./pages/appointments/PatientAppointmentsPage.jsx"));
const ConnectionChatPage = lazy(() => import("./pages/connections/ConnectionChatPage.jsx"));
const ConnectionsPage = lazy(() => import("./pages/connections/ConnectionsPage.jsx"));
const DoctorProfilePage = lazy(() => import("./pages/doctors/DoctorProfilePage.jsx"));
const DoctorsPage = lazy(() => import("./pages/doctors/DoctorsPage.jsx"));
const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const GamesPage = lazy(() => import("./pages/wellness/GamesPage.jsx"));
const GamePlayPage = lazy(() => import("./pages/wellness/GamePlayPage.jsx"));
const MovementPage = lazy(() => import("./pages/wellness/MovementPage.jsx"));
const MovementTutorialPage = lazy(
  () => import("./pages/wellness/MovementTutorialPage.jsx"),
);
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
              <Route path="/appointments" element={<PatientAppointmentsPage />} />
              <Route path="/movement" element={<MovementPage />} />
              <Route path="/movement/:tutorialId" element={<MovementTutorialPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/games/:gameId" element={<GamePlayPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin" element={<HomePage />} />
              <Route path="/admin/appointments" element={<AdminAppointmentsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={["doctor"]} />}>
              <Route path="/doctor/profile" element={<DoctorProfilePage />} />
              <Route path="/doctor/appointments" element={<DoctorAppointmentsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
}
