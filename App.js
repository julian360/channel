// App.js
import React from 'react';
import ReactDOM from 'react-dom';

// Importa los módulos y funciones de Firebase desde firebase-init.js
import { db, auth, collection, query, onSnapshot, orderBy, __app_id } from './firebase-init.js';

// Importa componentes
import MessageDisplay from './components/MessageDisplay.js';
import LoadingSpinner from './components/LoadingSpinner.js';
import ChannelList from './components/ChannelList.js';

// Importa funciones de utilidad
import { generateRandomUserName, copyToClipboard } from './utils/helpers.js';

// Importa hooks personalizados
import { useAuthAndFirestore } from './hooks/useAuthAndFirestore.js';
import { useChannelManagement } from './hooks/useChannelManagement.js';
import { useWebRTC } from './hooks/useWebRTC.js';

// Componente principal de la aplicación.
const App = () => {
    // Estados de la aplicación.
    const [currentPage, setCurrentPage] = React.useState('home');
    const [channelName, setChannelName] = React.useState('');
    const [activeChannel, setActiveChannel] = React.useState(null);
    const [availableChannels, setAvailableChannels] = React.useState([]);
    const [message, setMessage] = React.useState(null);
    const [messageType, setMessageType] = React.useState('');
    const [currentMessage, setCurrentMessage] = React.useState('');
    const [chatMessages, setChatMessages] = React.useState([]);
    const [showOptionsMenu, setShowOptionsMenu] = React.useState(false);
    const [showActivityPanel, setShowActivityPanel] = React.useState(false);
    const [channelMembers, setChannelMembers] = React.useState([]);
    const [deferredPrompt, setDeferredPrompt] = React.useState(null);
    const [isPwaInstalled, setIsPwaInstalled] = React.useState(false);
    const [tigreCode, setTigreCode] = React.useState('');
    const [sortOption, setSortOption] = React.useState('activity');
    const [showExploreMenu, setShowExploreMenu] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showSearchInput, setShowSearchInput] = React.useState(false);

    // Refs para elementos DOM.
    const channelInputRef = React.useRef(null);
    const chatMessagesEndRef = React.useRef(null);
    const optionsMenuRef = React.useRef(null);
    const exploreMenuRef = React.useRef(null);
    const fileInputRef = React.useRef(null);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const peerConnectionRef = React.useRef(null);
    const searchInputRef = React.useRef(null);

    // Función para mostrar mensajes de retroalimentación.
    const showMessage = React.useCallback((msg, type = 'success') => {
        setMessage(msg);
        setMessageType(type);
        setTimeout(() => setMessage(null), 3000);
    }, []);

    // Hook para la autenticación y gestión del perfil de usuario.
    const {
        userId,
        userName,
        setUserName,
        userNameConfirmed,
        setUserNameConfirmed,
        isAuthReady,
        isLoading,
        setIsLoading,
        isTigre,
        setIsTigre,
        showTigreCodeInput,
        setShowTigreCodeInput,
        handleConfirmUserName,
        handleTigreCodeSubmit
    } = useAuthAndFirestore(showMessage);

    // Función para desplazarse al final de los mensajes del chat.
    const scrollToBottom = React.useCallback(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    // Hook para la gestión de canales (crear, unirse, eliminar, enviar mensajes, subir archivos).
    const {
        handleCreateChannel,
        handleJoinChannelFromExplore,
        handleDeleteChannel,
        handleSendMessage,
        onFileSelected
    } = useChannelManagement(
        userId,
        userName,
        isAuthReady,
        isTigre,
        showMessage,
        setIsLoading,
        setCurrentPage,
        setActiveChannel,
        fetchChannels // Se pasa la función fetchChannels para recargar la lista de canales.
    );

    // Hook para la gestión de WebRTC (streaming).
    const {
        requestMediaPermissions,
        stopReceivingStream,
        receiveStream,
        stopStreaming,
        startStreaming
    } = useWebRTC(
        userId,
        userName,
        activeChannel,
        showMessage,
        setIsLoading,
        null, // localStream (se gestiona internamente en useWebRTC)
        null, // remoteStream (se gestiona internamente en useWebRTC)
        null, // isStreaming (se gestiona internamente en useWebRTC)
        null, // setIsStreaming (se gestiona internamente en useWebRTC)
        null, // isReceivingStream (se gestiona internamente en useWebRTC)
        null, // setIsReceivingStream (se gestiona internamente en useWebRTC)
        null, // isStreamer (se gestiona internamente en useWebRTC)
        null, // setIsStreamer (se gestiona internamente en useWebRTC)
        null, // isStartingStream (se gestiona internamente en useWebRTC)
        peerConnectionRef,
        localVideoRef,
        remoteVideoRef
    );

    // PWA: Maneja el evento beforeinstallprompt.
    React.useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            console.log('Evento beforeinstallprompt disparado!');
        };
        window.addEventListener('beforeinstallprompt', handler);
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsPwaInstalled(true);
        }
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // PWA: Maneja el evento appinstalled.
    React.useEffect(() => {
        const handleAppInstalled = () => {
            setIsPwaInstalled(true);
            setDeferredPrompt(null);
            showMessage('Instalando CHANNEL App...', 'success');
            console.log('PWA instalado');
        };
        window.addEventListener('appinstalled', handleAppInstalled);
        return () => window.removeEventListener('appinstalled', handleAppInstalled);
    }, [showMessage]);

    // Efectos de depuración para isLoading y currentPage.
    React.useEffect(() => {
        console.log(`DEBUG PROFUNDO: isLoading cambió a: ${isLoading}`);
    }, [isLoading]);

    React.useEffect(() => {
        console.log(`DEBUG PROFUNDO: currentPage cambió a: ${currentPage}`);
    }, [currentPage]);

    // Efecto para manejar el historial del navegador (popstate).
    React.useEffect(() => {
        const handlePopState = (event) => {
            if (event.state && event.state.page) {
                setCurrentPage(event.state.page);
                if (event.state.page !== 'channel') {
                    console.log("DEBUG PROFUNDO: handlePopState - Navegando fuera del canal. Iniciando limpieza del stream.");
                    stopStreaming();
                }
            } else {
                setCurrentPage('home');
                console.log("DEBUG PROFUNDO: handlePopState - Navegando a inicio. Iniciando limpieza del stream.");
                stopStreaming();
            }
        };
        window.addEventListener('popstate', handlePopState);
        window.history.pushState({ page: currentPage }, document.title, null);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [currentPage, stopStreaming]);

    // Efecto para actualizar el historial del navegador.
    React.useEffect(() => {
        if (currentPage && (!window.history.state || window.history.state.page !== currentPage)) {
            window.history.pushState({ page: currentPage }, document.title, null);
        }
    }, [currentPage]);

    // Efecto para cerrar menús al hacer clic fuera.
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target)) {
                setShowOptionsMenu(false);
                setShowActivityPanel(false);
            }
            if (exploreMenuRef.current && !exploreMenuRef.current.contains(event.target)) {
                setShowExploreMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [optionsMenuRef, exploreMenuRef]);

    // Función para obtener los canales disponibles.
    const fetchChannels = React.useCallback(async () => {
        if (!isAuthReady || !db) {
            console.log("DEBUG PROFUNDO: fetchChannels - Firebase no listo o db es nulo. Saliendo.");
            return;
        }
        setIsLoading(true);
        console.log("DEBUG PROFUNDO: fetchChannels - Objeto db actual:", db);
        console.log("DEBUG PROFUNDO: fetchChannels - auth.currentUser actual:", auth.currentUser);
        console.log("DEBUG PROFUNDO: fetchChannels - Usando __app_id:", __app_id);
        const channelsColRef = collection(db, `artifacts/${__app_id}/public/data/channels`);
        console.log("DEBUG PROFUNDO: fetchChannels - Intentando obtener canales de la ruta:", channelsColRef.path, "con userId:", userId);
        const q = query(channelsColRef);

        try {
            const snapshot = await getDocs(q);
            const channelsData = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().displayName || doc.id,
                createdAt: doc.data().createdAt,
                createdBy: doc.data().createdBy,
                creatorUserName: doc.data().creatorUserName,
                lastActivity: doc.data().lastActivity,
                isStreaming: doc.data().isStreaming || false
            }));

            let processedChannels = [...channelsData];

            if (sortOption === 'activity') {
                processedChannels.sort((a, b) => {
                    const dateA = a.lastActivity ? a.lastActivity.toDate() : new Date(a.createdAt);
                    const dateB = b.lastActivity ? b.lastActivity.toDate() : new Date(b.createdAt);
                    return dateB.getTime() - dateA.getTime();
                });
            } else if (sortOption === 'recent') {
                processedChannels.sort((a, b) => {
                    const dateA = new Date(a.createdAt);
                    const dateB = new Date(b.createdAt);
                    return dateB.getTime() - dateA.getTime();
                });
            }

            if (searchQuery) {
                processedChannels = processedChannels.filter(channel =>
                    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            setAvailableChannels(processedChannels);
            console.log("DEBUG PROFUNDO: Canales obtenidos y procesados:", processedChannels);
        } catch (error) {
            console.error("DEBUG PROFUNDO: Error obteniendo canales:", error);
            if (error.code === 'unavailable' || error.code === 'permission-denied') {
                showMessage("Error de conexión o permisos. Asegúrate de que tus reglas de Firestore sean correctas y tengas conexión a internet.", 'error');
            } else {
                showMessage("Error cargando canales. Revisa la consola.", 'error');
            }
            setIsLoading(false);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthReady, db, auth, sortOption, searchQuery, showMessage, setIsLoading, setAvailableChannels, userId, __app_id]);

    // Efecto para cargar canales al entrar en la página de exploración y refrescarlos periódicamente.
    React.useEffect(() => {
        let intervalId;
        if (currentPage === 'explore') {
            fetchChannels();
            intervalId = setInterval(fetchChannels, 60000);
        }
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [currentPage, fetchChannels]);

    // Efecto para enfocar el input de búsqueda.
    React.useEffect(() => {
        if (showSearchInput && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [showSearchInput]);

    // Efecto principal para listeners de datos del canal en Firestore.
    React.useEffect(() => {
        console.log("DEBUG PROFUNDO: Efecto principal del Canal re-ejecutándose. Dependencias:", { isAuthReady, db, activeChannel, currentPage, userId, isReceivingStream, localStream, isStreaming, isStartingStream, isStreamer });

        if (isAuthReady && db && activeChannel && currentPage === 'channel') {
            const normalizedActiveChannel = activeChannel.name.toLowerCase();
            const messagesColRef = collection(db, `artifacts/${__app_id}/public/data/channels/${normalizedActiveChannel}/messages`);
            const q = query(messagesColRef, orderBy('timestamp'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const messagesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setChatMessages(messagesData);
                scrollToBottom();
                console.log("DEBUG PROFUNDO: Mensajes de chat actualizados:", messagesData);
            }, (error) => {
                console.error("DEBUG PROFUNDO: Error obteniendo mensajes de chat:", error);
                if (error.code === 'unavailable' || error.code === 'permission-denied') {
                    showMessage("Error de conexión o permisos al cargar mensajes. Revisa las reglas de Firestore.", 'error');
                } else {
                    showMessage("Error cargando mensajes de chat. Revisa la consola.", 'error');
                }
            });

            const membersColRef = collection(db, `artifacts/${__app_id}/public/data/channels/${normalizedActiveChannel}/members`);
            const unsubscribeMembers = onSnapshot(membersColRef, (snapshot) => {
                const membersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setChannelMembers(membersData);
                console.log("DEBUG PROFUNDO: Miembros del canal actualizados:", membersData);
            }, (error) => {
                console.error("DEBUG PROFUNDO: Error obteniendo miembros del canal:", error);
            });

            const channelDocRef = doc(db, `artifacts/${__app_id}/public/data/channels`, normalizedActiveChannel);
            const unsubscribeChannelStatus = onSnapshot(channelDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const channelData = docSnap.data();
                    const currentStreamerIdInFirestore = channelData.streamerId;
                    const isChannelStreamingInFirestore = channelData.isStreaming || false;

                    console.log("DEBUG PROFUNDO: onSnapshot - Datos del canal de Firestore:", channelData);
                    console.log("DEBUG PROFUNDO: onSnapshot - Estado de streaming del canal en Firestore:", isChannelStreamingInFirestore, "ID del Streamer en Firestore:", currentStreamerIdInFirestore, "ID de Usuario Actual:", userId);
                    console.log("DEBUG PROFUNDO: onSnapshot - isStreaming local:", isStreaming, "isReceivingStream local:", isReceivingStream, "isStreamer local:", isStreamer);

                    if (isChannelStreamingInFirestore && currentStreamerIdInFirestore && currentStreamerIdInFirestore !== userId && !isReceivingStream) {
                        if (!isStartingStream) {
                            showMessage(`Stream activo en este canal por ${channelData.streamerUserName || 'alguien'}. Uniéndote como espectador...`, 'info');
                            console.log("DEBUG PROFUNDO: Intentando unirse al stream como espectador.");
                            receiveStream(normalizedActiveChannel, currentStreamerIdInFirestore);
                        } else {
                            console.log("DEBUG PROFUNDO: onSnapshot - isStartingStream es true. Ignorando la unión del espectador para evitar condiciones de carrera durante la configuración del streamer.");
                        }
                    } else if (!isChannelStreamingInFirestore && currentStreamerIdInFirestore !== userId && isReceivingStream) {
                        showMessage("El stream ha terminado.", 'info');
                        console.log("DEBUG PROFUNDO: Stream terminado (lado del espectador).");
                        setTimeout(() => stopReceivingStream(), 500);
                    } else if (isStreaming && isStreamer && (!isChannelStreamingInFirestore || currentStreamerIdInFirestore !== userId)) {
                        if (!isStartingStream) {
                            console.warn("DEBUG PROFUNDO: El estado local del streamer está activo, pero Firestore muestra inactivo o un streamer diferente. Forzando la detención del stream local.");
                            console.trace("DEBUG PROFUNDO: Pila de llamadas para la detención forzada del stream (lado del streamer).");
                            showMessage("Tu stream ha terminado o ha sido desconectado (detectado por Firestore).", 'info');
                            setTimeout(() => stopStreaming(), 500);
                        } else {
                            console.log("DEBUG PROFUNDO: onSnapshot - El streamer está iniciando el stream. Ignorando la desincronización temporal del estado de Firestore.");
                        }
                    }
                }
            }, (error) => {
                console.error("DEBUG PROFUNDO: Error obteniendo el estado de streaming del canal:", error);
                if (isStreaming || isReceivingStream) {
                    showMessage("Error al obtener el estado del stream. Deteniendo el stream.", 'error');
                    setTimeout(() => stopStreaming(), 500);
                }
            });

            return () => {
                unsubscribe();
                unsubscribeMembers();
                unsubscribeChannelStatus();
                setChatMessages([]);
                setChannelMembers([]);
                console.log("DEBUG PROFUNDO: Limpiando estados de mensajes y miembros del canal.");
            };
        } else {
            setChatMessages([]);
            setChannelMembers([]);
            console.log("DEBUG PROFUNDO: Limpiando estados de mensajes y miembros del canal (sin canal activo).");
        }
    }, [isAuthReady, db, activeChannel, currentPage, showMessage, scrollToBottom, userId, isReceivingStream, localStream, isStreaming, isStartingStream, isStreamer, stopStreaming, stopReceivingStream]);

    // Efecto dedicado para la limpieza del stream WebRTC.
    React.useEffect(() => {
        if (!activeChannel || currentPage !== 'channel') {
            if (isStreaming || isReceivingStream) {
                console.log("DEBUG PROFUNDO: useEffect de limpieza de WebRTC disparado: Deteniendo stream activo debido a salida del canal o cambio de página.");
                stopStreaming();
            }
        }
    }, [activeChannel, currentPage, isStreaming, isReceivingStream, stopStreaming]);

    // Manejador para el botón de instalar PWA.
    const handleInstallClick = React.useCallback(async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Respuesta del usuario al prompt de instalación: ${outcome}`);
            setDeferredPrompt(null);
        }
    }, [deferredPrompt]);

    // Manejador para adjuntar archivos.
    const handleAttachFile = React.useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
        setShowOptionsMenu(false);
    }, []);

    // Renderizado de la página de inicio.
    const renderHomePage = () => (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 p-4 font-inter">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
                <h1 className="text-4xl font-extrabold text-gray-800 mb-6">CHANNEL</h1>

                {deferredPrompt && !isPwaInstalled && (
                    <button
                        onClick={handleInstallClick}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 text-xl mb-3"
                    >
                        Install App
                    </button>
                )}

                <div className="mb-6">
                    <label htmlFor="username-input" className="block text-gray-700 text-sm font-bold mb-2">
                        Your Username:
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="username-input"
                            type="text"
                            placeholder="Username"
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                            value={userName}
                            onChange={(e) => {
                                setUserName(e.target.value);
                                setUserNameConfirmed(false);
                                setIsTigre(false);
                                setShowTigreCodeInput(false);
                                setTigreCode('');
                            }}
                            maxLength="48"
                            disabled={userNameConfirmed}
                        />
                        {!userNameConfirmed && (
                            <button
                                onClick={handleConfirmUserName}
                                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300"
                            >
                                Confirm
                            </button>
                        )}
                        {userNameConfirmed && (
                            <button
                                onClick={() => {
                                    setUserNameConfirmed(false);
                                    setIsTigre(false);
                                    setShowTigreCodeInput(false);
                                    setTigreCode('');
                                    // Desactiva el modo Tigre en Firestore si el usuario lo edita.
                                    if (db && userId) {
                                        const userProfileRef = doc(db, `artifacts/${__app_id}/users/${userId}/profile`, 'userProfile');
                                        setDoc(userProfileRef, { isTigreActive: false }, { merge: true }).catch(e => console.error("Error desactivando Tigre en Firestore:", e));
                                    }
                                }}
                                className="bg-gray-400 hover:bg-400 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300"
                            >
                                Edit
                            </button>
                        )}
                    </div>
                </div>

                {userNameConfirmed && userName.trim() === 'Julian360' && showTigreCodeInput && !isTigre && (
                    <div className="mt-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
                        <p className="mb-2 font-semibold">Tigre Mode: Enter the 8-digit code to enable.</p>
                        <input
                            type="password"
                            placeholder="8-digit code"
                            className="w-full p-3 border border-yellow-400 rounded-lg focus:outline-none focus:ring-2 focus:focus:ring-yellow-500"
                            value={tigreCode}
                            onChange={(e) => setTigreCode(e.target.value)}
                            maxLength="8"
                        />
                        <button
                            onClick={() => handleTigreCodeSubmit(tigreCode)}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-300"
                        >
                            Confirm Code
                        </button>
                    </div>
                )}
                {isTigre && (
                    <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                        <p className="font-semibold">Tigre Mode Activated!</p>
                    </div>
                )}

                <div className="mb-6">
                    <input
                        id="channel-name-input"
                        ref={channelInputRef}
                        type="text"
                        placeholder="Channel name"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleCreateChannel(channelName, channelInputRef);
                            }
                        }}
                        maxLength="128"
                        disabled={!userNameConfirmed}
                    />
                </div>

                <button
                    onClick={() => handleCreateChannel(channelName, channelInputRef)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 text-xl mb-4"
                    disabled={!userNameConfirmed}
                >
                    Enter
                </button>

                <button
                    onClick={() => setCurrentPage('explore')}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition duration-300 hover:scale-105 text-xl"
                    disabled={!userNameConfirmed}
                >
                    Explore Channels
                </button>
            </div>
        </div>
    );

    // Renderizado de la página de canal.
    const renderChannelPage = () => (
        <div className="relative flex flex-col items-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 font-inter">
            <div className="h-full bg-white p-4 rounded-2xl shadow-2xl w-full max-w-2xl text-center mt-6 mb-2 pb-1 relative">
                <h1
                    className="text-4xl font-extrabold text-gray-800 mb-2 cursor-pointer"
                    onClick={() => copyToClipboard(activeChannel.name, showMessage)}
                >
                    Channel: <span className="text-blue-600">{activeChannel.name}</span>
                </h1>
                <p className="text-lg text-gray-600 mb-2">User: <span className="font-bold text-purple-600">{userName}</span></p>

                <div className="absolute top-4 right-4" ref={optionsMenuRef}>
                    <button
                        onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                        className="text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label="Channel options"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                    {showOptionsMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                            {isStreamer ? (
                                <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" onClick={() => { stopStreaming(); setShowOptionsMenu(false); }}>Stop Stream ⏹️</button>
                            ) : (
                                <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" onClick={() => { startStreaming(); setShowOptionsMenu(false); }}>Stream 🎥</button>
                            )}
                            <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" onClick={handleAttachFile}>Attach File 📎</button>
                            <button className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" onClick={() => { setShowActivityPanel(true); setShowOptionsMenu(false); }}>Activity 👥</button>
                        </div>
                    )}
                </div>

                {(isStreaming || isReceivingStream) && (
                    <div className="relative w-full aspect-video bg-black rounded-lg mb-4 overflow-hidden">
                        {isStreamer && (
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="absolute inset-0 w-full h-full object-contain"
                                style={{ transform: 'scaleX(-1)' }}
                            ></video>
                        )}
                        {!isStreamer && (
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="absolute inset-0 w-full h-full object-contain"
                            ></video>
                        )}
                        {(!localVideoRef.current?.srcObject && !remoteVideoRef.current?.srcObject) && (
                            <div className="absolute inset-0 flex items-center justify-center text-white text-xl">
                                Waiting for stream...
                            </div>
                        )}
                        {!isStreamer && remoteVideoRef.current?.srcObject && (remoteVideoRef.current.paused || remoteVideoRef.current.muted) && (
                            <button
                                onClick={() => {
                                    if (remoteVideoRef.current) {
                                        remoteVideoRef.current.muted = false;
                                        remoteVideoRef.current.play().catch(error => {
                                            console.error("DEBUG PROFUNDO: Error al intentar reproducir video remoto desde el botón de desmutear:", error);
                                            showMessage("Error al reproducir el video. Verifique los permisos de reproducción automática.", 'error');
                                        });
                                        showMessage("Video desmuteado.", 'info');
                                    }
                                }}
                                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-xl font-bold rounded-lg cursor-pointer hover:bg-opacity-75 transition-opacity duration-200"
                            >
                                ▶️ Play Stream
                            </button>
                        )}
                    </div>
                )}

                <div className="mb-1 w-full bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
                    <div className="h-[70vh] md:h-[66vh] bg-white rounded-lg p-2 overflow-y-auto border border-gray-300 mb-1 flex flex-col" style={{ minHeight: '100px' }}>
                        {chatMessages.length > 0 ? (
                            chatMessages.map((msg) => (
                                <div key={msg.id} className={`mb-2 p-2 rounded-lg ${msg.senderId === userId ? 'bg-blue-100 self-end text-right' : 'bg-gray-200 self-start text-left'}`} style={{ maxWidth: '80%' }}>
                                    <p className="font-semibold text-xs">{msg.senderId === userId ? 'You' : msg.senderUserName}</p>
                                    {msg.fileUrl ? (
                                        msg.fileType && msg.fileType.startsWith('image/') ? (
                                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                                                <img src={msg.fileUrl} alt={msg.fileName || 'Attached image'} className="max-w-xs max-h-32 rounded-lg object-contain mb-1" />
                                                <span className="text-blue-600 underline text-sm md:text-base">
                                                    🖼️ {msg.fileName || 'Attached Image'}
                                                </span>
                                            </a>
                                        ) :
                                        msg.fileType && msg.fileType.startsWith('audio/') ? (
                                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="block w-full max-w-sm">
                                                <audio controls src={msg.fileUrl} className="w-full mb-1"></audio>
                                                <span className="text-blue-600 underline text-sm md:text-base">
                                                    🎵 {msg.fileName || 'Attached Audio'}
                                                </span>
                                            </a>
                                        ) :
                                        msg.fileType && msg.fileType.startsWith('video/') ? (
                                            <div className="flex flex-col items-start">
                                                <p className="text-sm md:text-base text-gray-800 mb-1">
                                                    ▶️ <strong>Video</strong>
                                                </p>
                                                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm md:text-base">
                                                    {msg.fileName || 'Attached Video'}
                                                </a>
                                            </div>
                                        ) : (
                                            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm md:text-base">
                                                📎 {msg.fileName || 'Attached File'}
                                            </a>
                                        )
                                    ) : (
                                        <p className="text-sm md:text-base text-gray-800">{msg.text}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 italic m-auto">Sé el primero en enviar un mensaje.</p>
                        )}
                        <div ref={chatMessagesEndRef} />
                    </div>
                    <input
                        type="text"
                        placeholder="Escribe tu mensaje..."
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:focus:ring-blue-500"
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleSendMessage(currentMessage, activeChannel, chatMessagesEndRef, setCurrentMessage, scrollToBottom);
                            }
                        }}
                        disabled={!isAuthReady || !db || !userId}
                    />
                    <input
                        type="file"
                        id="file-upload-input"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={(e) => onFileSelected(e, activeChannel, userId, userName, showMessage, setIsLoading, scrollToBottom)}
                    />
                </div>
            </div>

            {showActivityPanel && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-40">
                    <div className="bg-white w-full max-w-xs p-6 rounded-l-2xl shadow-lg flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Actividad del Canal</h2>
                            <button
                                onClick={() => setShowActivityPanel(false)}
                                className="text-gray-500 hover:text-gray-700 text-3xl font-bold"
                            >
                                &times;
                            </button>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-3">Miembros del Canal:</h3>
                        <div className="flex-grow overflow-y-auto">
                            {channelMembers.length > 0 ? (
                                <ul className="space-y-2">
                                    {channelMembers.map((member) => (
                                        <li key={member.id} className="flex items-center text-gray-700">
                                            <span className="font-medium">{member.userName}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 italic">No hay miembros registrados todavía.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Renderizado de la página de exploración de canales.
    const renderExplorePage = () => (
        <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-teal-500 to-cyan-600 p-4 font-inter">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl text-center mt-8 relative">
                <h1 className="text-4xl font-extrabold text-gray-800 mb-6">Explorar Canales</h1>
                <p className="text-lg text-gray-600 mb-8"> </p>

                <div className="absolute top-4 right-4" ref={exploreMenuRef}>
                    <button
                        onClick={() => setShowExploreMenu(!showExploreMenu)}
                        className="text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label="Explore options"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                    </button>
                    {showExploreMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                            <button
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                onClick={() => { setSortOption('activity'); setShowExploreMenu(false); setShowSearchInput(false); setSearchQuery(''); }}
                            >
                                Más Activos
                            </button>
                            <button
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                onClick={() => { setSortOption('recent'); setShowExploreMenu(false); setShowSearchInput(false); setSearchQuery(''); }}
                            >
                                Más Recientes
                            </button>
                            <button
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                onClick={() => {
                                    setShowSearchInput(!showSearchInput);
                                    setShowExploreMenu(false);
                                    setSortOption('none');
                                }}
                            >
                                Buscar Canal
                            </button>
                        </div>
                    )}
                </div>

                {showSearchInput && (
                    <div className="mb-6 mt-4">
                        <input
                            type="text"
                            placeholder="Buscar canal por nombre..."
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-lg"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            ref={searchInputRef}
                        />
                    </div>
                )}

                {/* Utiliza el componente ChannelList aquí */}
                <ChannelList
                    availableChannels={availableChannels}
                    handleJoinChannelFromExplore={handleJoinChannelFromExplore}
                    handleDeleteChannel={handleDeleteChannel}
                    userId={userId}
                    isTigre={isTigre}
                />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col">
            <MessageDisplay message={message} type={messageType} onClose={() => setMessage(null)} />
            {isLoading && <LoadingSpinner />}
            {currentPage === 'home' ? renderHomePage() : (currentPage === 'channel' ? renderChannelPage() : renderExplorePage())}
        </div>
    );
};

// Renderiza el componente App en el elemento 'root' del DOM.
ReactDOM.render(<App />, document.getElementById('root'));
