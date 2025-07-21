// components/LoadingSpinner.js
import React from 'react';

const LoadingSpinner = () => (
    <div className="fixed inset-0 flex items-center justify-center z-50">
        <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: '20px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner"></div>
            <p className="ml-4 text-white text-lg">Cargando...</p>
        </div>
    </div>
);

export default LoadingSpinner;