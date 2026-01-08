import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Optional loading screen
  if (loading) {
    return <div>Loading...</div>;
  }

  // ❌ Not logged in → redirect
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ✅ Logged in → allow access
  return children;
};

export default ProtectedRoute;
