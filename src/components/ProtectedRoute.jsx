import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // If not admin, redirect to login
  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  // If admin, allow access
  return children;
};

export default ProtectedRoute;
