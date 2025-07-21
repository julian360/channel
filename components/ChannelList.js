// components/ChannelList.js
import React from 'react';

// Componente para mostrar la lista de canales disponibles.
const ChannelList = ({ availableChannels, handleJoinChannelFromExplore, handleDeleteChannel, userId, isTigre }) => {
    return (
        availableChannels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableChannels.map((channel) => (
                    <div key={channel.id} className="bg-gray-100 p-4 rounded-lg shadow-md flex flex-col items-center justify-between">
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">{channel.name}</h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Created by: {channel.creatorUserName || 'Unknown'}
                        </p>
                        {channel.isStreaming && (
                            <span className="text-sm font-bold text-red-500 mb-2">🔴 LIVE</span>
                        )}
                        <button
                            onClick={() => handleJoinChannelFromExplore(channel)}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 mb-2"
                        >
                            Join
                        </button>
                        {(userId === channel.createdBy || isTigre) && (
                            <button
                                onClick={() => handleDeleteChannel(channel.name)}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
                            >
                                Delete Channel
                            </button>
                        )}
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-gray-500 italic">No channels available. Create one!</p>
        )
    );
};

export default ChannelList;
