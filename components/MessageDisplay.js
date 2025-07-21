// components/MessageDisplay.js
import React from 'react';

const MessageDisplay = ({ message, type, onClose }) => {
    if (!message) return null;

    const bgColor = type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700';
    const borderColor = type === 'error' ? 'border-red-500' : 'border-green-500';

    return (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center justify-between z-50 ${bgColor} border ${borderColor}`}>
            <p className="font-semibold">{message}</p>
            <button onClick={onClose} className="ml-4 text-lg font-bold">
                &times;
            </button>
        </div>
    );
};

export default MessageDisplay;