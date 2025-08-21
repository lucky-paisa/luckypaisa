import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // ✅ Only allow if Firestore role says admin
  return user.isAdmin ? children : <Navigate to="/home" replace />;
}
