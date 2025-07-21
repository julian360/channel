// hooks/useChannelManagement.js
import React from 'react';
import { db, collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, deleteDoc, doc, getDoc, setDoc, deleteField, __app_id } from '../firebase-init.js';

// Hook personalizado para manejar la creación, unión y eliminación de canales.
export const useChannelManagement = (
    userId,
    userName,
    isAuthReady,
    isTigre,
    showMessage,
    setIsLoading,
    setCurrentPage,
    setActiveChannel,
    fetchChannels // Se pasa como dependencia para recargar la lista de canales.
) => {
    // Función para crear o unirse a un canal.
    const handleCreateChannel = React.useCallback(async (channelNameInput, channelInputRef) => {
        console.log("DEBUG PROFUNDO: handleCreateChannel - Iniciado.");
        if (channelNameInput.trim() === '') {
            showMessage('Por favor, introduce un nombre para el canal.', 'error');
            if (channelInputRef.current) {
                channelInputRef.current.focus();
            }
            return;
        }
        if (channelNameInput.trim().length > 128) {
            showMessage('El nombre del canal no puede exceder los 128 caracteres.', 'error');
            return;
        }
        if (!isAuthReady || !db || !userId) {
            console.warn("DEBUG PROFUNDO: handleCreateChannel - Firebase no está listo todavía. Por favor, espera.");
            showMessage("La autenticación no está lista. Por favor, inténtalo de nuevo.", 'error');
            return;
        }

        const normalizedChannelName = channelNameInput.trim().toLowerCase();
        const originalChannelInput = channelNameInput.trim();

        setIsLoading(true);
        console.log("DEBUG PROFUNDO: handleCreateChannel - isLoading establecido en true.");
        try {
            const channelDocRef = doc(db, `artifacts/${__app_id}/public/data/channels`, normalizedChannelName);
            console.log("DEBUG PROFUNDO: handleCreateChannel - Intentando obtener el documento del canal.");
            const docSnap = await getDoc(channelDocRef);
            console.log("DEBUG PROFUNDO: handleCreateChannel - Documento del canal recibido.");

            if (docSnap.exists()) {
                const existingChannelDisplayName = docSnap.data().displayName || normalizedChannelName;
                setActiveChannel({ name: existingChannelDisplayName }); // Establece activeChannel como un objeto.
                setCurrentPage('channel');
                showMessage(`Te has unido al canal: ${existingChannelDisplayName}`, 'success');
                console.log("DEBUG PROFUNDO: handleCreateChannel - Canal existente unido:", existingChannelDisplayName);
            } else {
                await setDoc(channelDocRef, {
                    name: normalizedChannelName,
                    displayName: originalChannelInput,
                    createdAt: new Date().toISOString(),
                    createdBy: userId,
                    creatorUserName: userName,
                    lastActivity: serverTimestamp(),
                    isStreaming: false, // Inicializa el estado de streaming.
                    streamerId: null // Inicializa el ID del streamer.
                });
                setActiveChannel({ name: originalChannelInput }); // Establece activeChannel como un objeto.
                setCurrentPage('channel');
                showMessage(`¡Canal "${originalChannelInput}" creado y te has unido!`, 'success');
                console.log("DEBUG PROFUNDO: handleCreateChannel - Canal creado y unido:", originalChannelInput);
            }

            const memberDocRef = doc(db, `artifacts/${__app_id}/public/data/channels/${normalizedChannelName}/members`, userId);
            console.log("DEBUG PROFUNDO: handleCreateChannel - Intentando añadir miembro.");
            await setDoc(memberDocRef, {
                userName: userName,
                joinedAt: serverTimestamp()
            }, { merge: true });
            console.log("DEBUG PROFUNDO: handleCreateChannel - Miembro añadido. Estableciendo isLoading en falso.");

        } catch (error) {
            console.error("DEBUG PROFUNDO: Error creando o uniéndose al canal (bloque catch):", error);
            if (error.code === 'unavailable' || error.code === 'permission-denied') {
                showMessage("Error de conexión o permisos. Asegúrate de que tus reglas de Firestore sean correctas y tengas conexión a internet.", 'error');
            } else {
                showMessage("Error creando o uniéndose al canal. Revisa la consola.", 'error');
            }
            setIsLoading(false); // Asegura que isLoading sea falso en caso de error.
        } finally {
            console.log("DEBUG PROFUNDO: handleCreateChannel - Bloque finally ejecutado. Estableciendo isLoading en falso.");
            setIsLoading(false);
        }
    }, [userName, isAuthReady, db, userId, showMessage, setIsLoading, setCurrentPage, setActiveChannel]);

    // Función para unirse a un canal desde la página de exploración.
    const handleJoinChannelFromExplore = React.useCallback(async (channelToJoin) => {
        console.log("DEBUG PROFUNDO: handleJoinChannelFromExplore - Iniciado para el canal:", channelToJoin.name);
        setActiveChannel(channelToJoin); // activeChannel ya es un objeto de availableChannels.
        setCurrentPage('channel');
        showMessage(`Te has unido al canal: ${channelToJoin.name}`, 'success');
        console.log("DEBUG PROFUNDO: handleJoinChannelFromExplore - Canal unido:", channelToJoin.name);

        if (!isAuthReady || !db || !userId || !userName) {
            console.warn("DEBUG PROFUNDO: handleJoinChannelFromExplore - Firebase, usuario o nombre de usuario no listos. No se puede añadir miembro.");
            return;
        }

        setIsLoading(true);
        console.log("DEBUG PROFUNDO: handleJoinChannelFromExplore - isLoading establecido en true.");
        try {
            const normalizedChannelName = channelToJoin.name.toLowerCase();
            const memberDocRef = doc(db, `artifacts/${__app_id}/public/data/channels/${normalizedChannelName}/members`, userId);
            console.log("DEBUG PROFUNDO: handleJoinChannelFromExplore - Intentando añadir miembro.");
            await setDoc(memberDocRef, {
                userName: userName,
                joinedAt: serverTimestamp()
            }, { merge: true });
            console.log("DEBUG PROFUNDO: handleJoinChannelFromExplore - Miembro añadido. Estableciendo isLoading en falso.");
        } catch (error) {
            console.error("DEBUG PROFUNDO: Error añadiendo miembro al unirse al canal (bloque catch):", error);
            if (error.code === 'unavailable' || error.code === 'permission-denied') {
                showMessage("Error de conexión o permisos. Asegúrate de que tus reglas de Firestore sean correctas y tengas conexión a internet.", 'error');
            } else {
                showMessage("Error añadiendo miembro al canal. Revisa la consola.", 'error');
            }
            setIsLoading(false); // Asegura que isLoading sea falso en caso de error.
        } finally {
            console.log("DEBUG PROFUNDO: handleJoinChannelFromExplore - Bloque finally ejecutado. Estableciendo isLoading en falso.");
            setIsLoading(false);
        }
    }, [userName, isAuthReady, db, userId, showMessage, setCurrentPage, setActiveChannel]);

    // Función para eliminar un canal.
    const handleDeleteChannel = React.useCallback(async (channelDisplayName) => {
        console.log("DEBUG PROFUNDO: handleDeleteChannel - userId actual:", userId);
        console.log("DEBUG PROFUNDO: handleDeleteChannel - Iniciando eliminación para el canal:", channelDisplayName);
        const userConfirmed = await new Promise((resolve) => {
            const confirmModal = document.createElement('div');
            confirmModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            confirmModal.innerHTML = `
                <div class="bg-white p-6 rounded-lg shadow-xl text-center">
                    <p class="mb-4 text-lg">¿Estás seguro de que quieres eliminar el canal "${channelDisplayName}"? Esta acción es irreversible.</p>
                    <button id="confirmDelete" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg mr-2">Sí, Eliminar</button>
                    <button id="cancelDelete" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                </div>
            `;
            document.body.appendChild(confirmModal);

            document.getElementById('confirmDelete').onclick = () => {
                document.body.removeChild(confirmModal);
                resolve(true);
            };
            document.getElementById('cancelDelete').onclick = () => {
                document.body.removeChild(confirmModal);
                resolve(false);
            };
        });

        if (!userConfirmed) {
            console.log("DEBUG PROFUNDO: handleDeleteChannel - Eliminación cancelada por el usuario.");
            return;
        }

        if (!isAuthReady || !db || !userId) {
            console.warn("DEBUG PROFUNDO: handleDeleteChannel - Firebase no está listo o db/userId es nulo. No se puede eliminar.");
            showMessage("Firebase no está listo o no tienes un ID de usuario. No se puede eliminar el canal.", 'error');
            return;
        }

        const normalizedChannelId = channelDisplayName.toLowerCase();

        setIsLoading(true);
        console.log("DEBUG PROFUNDO: handleDeleteChannel - isLoading establecido en true.");
        try {
            const channelDocRef = doc(db, `artifacts/${__app_id}/public/data/channels`, normalizedChannelId);
            const docSnap = await getDoc(channelDocRef);

            if (!docSnap.exists()) {
                console.log("DEBUG PROFUNDO: handleDeleteChannel - El canal no existe.");
                showMessage("El canal no existe.", 'error');
                setIsLoading(false);
                return;
            }

            console.log("DEBUG PROFUNDO: handleDeleteChannel - Valores para la evaluación de permisos:");
            console.log("DEBUG PROFUNDO:   - userId (actual):", userId);
            console.log("DEBUG PROFUNDO:   - isTigre (estado de React):", isTigre);
            console.log("DEBUG PROFUNDO:   - channel.createdBy (desde Firestore):", docSnap.data().createdBy);
            console.log("DEBUG PROFUNDO:   - userId === channel.createdBy?:", userId === docSnap.data().createdBy);

            if (isTigre || docSnap.data().createdBy === userId) {
                console.log("DEBUG PROFUNDO: handleDeleteChannel - Permiso CONCEDIDO. Iniciando eliminación de subcolecciones y canal.");

                const messagesColRef = collection(db, `artifacts/${__app_id}/public/data/channels/${normalizedChannelId}/messages`);
                const messagesSnapshot = await getDocs(messagesColRef);
                const deleteMessagePromises = [];
                messagesSnapshot.forEach(msgDoc => {
                    deleteMessagePromises.push(deleteDoc(doc(db, `artifacts/${__app_id}/public/data/channels/${normalizedChannelId}/messages`, msgDoc.id)));
                });
                console.log(`DEBUG PROFUNDO: handleDeleteChannel - Eliminando ${deleteMessagePromises.length} mensajes.`);
                await Promise.all(deleteMessagePromises);
                console.log("DEBUG PROFUNDO: handleDeleteChannel - Todos los mensajes eliminados.");

                const membersColRef = collection(db, `artifacts/${__app_id}/public/data/channels/${normalizedChannelId}/members`);
                const membersSnapshot = await getDocs(membersColRef);
                const deleteMemberPromises = [];
                membersSnapshot.forEach(memberDoc => {
                    deleteMemberPromises.push(deleteDoc(doc(db, `artifacts/${__app_id}/public/data/channels/${normalizedChannelId}/members`, memberDoc.id)));
                });
                console.log(`DEBUG PROFUNDO: handleDeleteChannel - Eliminando ${deleteMemberPromises.length} miembros.`);
                await Promise.all(deleteMemberPromises);
                console.log("DEBUG PROFUNDO: handleDeleteChannel - Todos los miembros eliminados.");

                // Eliminar datos de señalización de WebRTC.
                console.log("DEBUG PROFUNDO: handleDeleteChannel - Comprobando datos de señalización de WebRTC.");
                const webrtcDocRef = doc(db, `artifacts/${__app_id}/public/data/channels/${normalizedChannelId}/webrtc_signaling`, 'webrtc_data');
                const webrtcDocSnap = await getDoc(webrtcDocRef);
                console.log("DEBUG PROFUNDO: handleDeleteChannel - webrtcDocSnap existe:", webrtcDocSnap.exists());

                if (webrtcDocSnap.exists()) {
                    console.log("DEBUG PROFUNDO: handleDeleteChannel - El documento de señalización de WebRTC existe. Procediendo con la eliminación.");
                    const candidatesColRef = collection(webrtcDocRef, 'candidates');
                    console.log("DEBUG PROFUNDO: handleDeleteChannel - Obteniendo candidatos de WebRTC.");
                    const candidatesSnapshot = await getDocs(candidatesColRef);
                    const deleteCandidatePromises = [];
                    candidatesSnapshot.forEach(candidateDoc => {
                        deleteCandidatePromises.push(deleteDoc(doc(candidatesColRef, candidateDoc.id)));
                    });
                    console.log(`DEBUG PROFUNDO: handleDeleteChannel - Eliminando ${deleteCandidatePromises.length} candidatos de WebRTC.`);
                    await Promise.all(deleteCandidatePromises);
                    console.log("DEBUG PROFUNDO: handleDeleteChannel - Todos los candidatos de WebRTC eliminados.");

                    // Luego, elimina el documento webrtc_data.
                    console.log("DEBUG PROFUNDO: handleDeleteChannel - Eliminando el documento principal de señalización de WebRTC.");
                    await deleteDoc(webrtcDocRef);
                    console.log("DEBUG PROFUNDO: handleDeleteChannel - Datos de señalización de WebRTC eliminados de Firestore.");
                } else {
                    console.log("DEBUG PROFUNDO: handleDeleteChannel - No se encontraron datos de señalización de WebRTC para eliminar.");
                }

                console.log("DEBUG PROFUNDO: handleDeleteChannel - Intentando eliminar el documento principal del canal:", normalizedChannelId);
                await deleteDoc(channelDocRef);
                console.log("DEBUG PROFUNDO: handleDeleteChannel - Documento principal del canal ELIMINADO exitosamente:", normalizedChannelId);

                showMessage(`¡Canal "${channelDisplayName}" eliminado exitosamente!`, 'success');
                console.log("DEBUG PROFUNDO: handleDeleteChannel - Mensaje mostrado, navegando a la página de exploración.");
                setCurrentPage('explore'); // Navega a la página de exploración.
                fetchChannels(); // Fuerza una recarga del contenido de los canales de exploración.
            } else {
                console.log("DEBUG PROFUNDO: handleDeleteChannel - Permiso DENEGADO. Condiciones no cumplidas.");
                showMessage("No tienes permiso para eliminar este canal.", 'error');
            }
        } catch (error) {
            console.error("DEBUG PROFUNDO: Error eliminando el canal (catch general):", error);
            console.error("DEBUG PROFUNDO: Código de error:", error.code);
            if (error.code === 'unavailable' || error.code === 'permission-denied') {
                showMessage("Error de conexión o permisos. Asegúrate de que tus reglas de Firestore sean correctas y tengas conexión a internet.", 'error');
            } else {
                showMessage("Error eliminando el canal. Revisa la consola.", 'error');
            }
            setIsLoading(false);
        } finally {
            console.log("DEBUG PROFUNDO: handleDeleteChannel - Bloque finally ejecutado. Estableciendo isLoading en falso.");
            setIsLoading(false);
        }
    }, [isAuthReady, db, userId, isTigre, showMessage, setIsLoading, setCurrentPage, setActiveChannel, fetchChannels, userName]); // Añadido userName a las dependencias.

    // Función para enviar mensajes en un canal.
    const handleSendMessage = React.useCallback(async (currentMessage, activeChannel, chatMessagesEndRef, setCurrentMessage, scrollToBottom) => {
        if (currentMessage.trim() === '') {
            return;
        }
        if (!isAuthReady || !db || !userId || !activeChannel || !userName) {
            console.warn("DEBUG PROFUNDO: handleSendMessage - Firebase, usuario, canal o nombre de usuario no están listos. No se puede enviar el mensaje.");
            showMessage("No se pudo enviar el mensaje. La aplicación no está lista.", 'error');
            return;
        }

        const normalizedActiveChannel = activeChannel.name.toLowerCase();
        try {
            const messagesColRef = collection(db, `artifacts/${__app_id}/public/data/channels/${normalizedActiveChannel}/messages`);
            console.log("DEBUG PROFUNDO: handleSendMessage - Enviando mensaje:", currentMessage.trim(), "al canal:", normalizedActiveChannel);
            await addDoc(messagesColRef, {
                text: currentMessage.trim(),
                senderId: userId,
                senderUserName: userName,
                timestamp: serverTimestamp(),
            });
            setCurrentMessage('');
            scrollToBottom();

            const channelDocRef = doc(db, `artifacts/${__app_id}/public/data/channels`, normalizedActiveChannel);
            await setDoc(channelDocRef, { lastActivity: serverTimestamp() }, { merge: true });
            console.log("DEBUG PROFUNDO: handleSendMessage - Última actividad del canal actualizada.");

        } catch (error) {
            console.error("DEBUG PROFUNDO: Error enviando mensaje:", error);
            if (error.code === 'unavailable' || error.code === 'permission-denied') {
                showMessage("Error de conexión o permisos al enviar el mensaje. Revisa las reglas de Firestore.", 'error');
            } else {
                showMessage("Error enviando mensaje. Revisa la consola.", 'error');
            }
        }
    }, [userName, isAuthReady, db, userId, showMessage]); // Eliminado activeChannel, chatMessagesEndRef, setCurrentMessage, scrollToBottom de las dependencias ya que se pasan como argumentos.

    // Función para adjuntar archivos.
    const onFileSelected = React.useCallback(async (event, activeChannel, userId, userName, showMessage, setIsLoading, scrollToBottom) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        if (!isAuthReady || !db || !userId || !activeChannel) {
            showMessage("La aplicación no está lista para subir archivos. Por favor, inténtalo de nuevo.", 'error');
            return;
        }

        setIsLoading(true);

        const cloudName = 'dq527zvti'; // Reemplaza con tu Cloudinary Cloud name.
        const unsignedUploadPreset = 'jlchannel'; // Reemplaza con tu unsigned upload preset de Cloudinary.

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', unsignedUploadPreset);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error subiendo archivo a Cloudinary:", errorData);
                showMessage(`Error subiendo archivo: ${errorData.error.message || 'Error desconocido'}`, 'error');
                return;
            }

            const data = await response.json();
            const downloadURL = data.secure_url;
            console.log('Archivo disponible en Cloudinary:', downloadURL);

            const normalizedActiveChannel = activeChannel.name.toLowerCase();
            const messagesColRef = collection(db, `artifacts/${__app_id}/public/data/channels/${normalizedActiveChannel}/messages`);
            await addDoc(messagesColRef, {
                text: downloadURL,
                senderId: userId,
                senderUserName: userName,
                timestamp: serverTimestamp(),
                fileUrl: downloadURL,
                fileName: file.name,
                fileType: file.type,
            });

            showMessage('Archivo subido y enviado al chat exitosamente.', 'success');
            scrollToBottom();

        } catch (error) {
            console.error("Error en la subida a Cloudinary (catch general):", error);
            showMessage(`Error iniciando la subida: ${error.message || 'Error desconocido'}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [isAuthReady, db, userId, userName, showMessage, setIsLoading]); // Eliminado activeChannel, scrollToBottom de las dependencias.

    return {
        handleCreateChannel,
        handleJoinChannelFromExplore,
        handleDeleteChannel,
        handleSendMessage,
        onFileSelected
    };
};
