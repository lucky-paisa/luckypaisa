import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';


function App() {
  // Ensure scroll isn't blocked on mount
  useEffect(() => {
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowY = 'auto';
    const root = document.getElementById('root');
    if (root) root.style.overflowY = 'auto';
  }, []); 

  return (
    <div style={{ minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/admin" element={ <ProtectedRoute> <AdminDashboard /> </ProtectedRoute> } />
      </Routes>
    </div>
  );
}

export default App;