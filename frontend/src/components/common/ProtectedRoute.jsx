import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext.jsx";

export default function ProtectedRoute({ roles }) {
  const { user, status, error } = useAuth();

  if (status === "loading") {
    return <p className="page-status">Checking your sign-in...</p>;
  }
  if (status === "error") {
    return <p className="page-error" role="alert">{error}</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }
  return <Outlet />;
}
