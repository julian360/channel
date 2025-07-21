// hooks/useWebRTC.js
import React from 'react';
import { db, auth, doc, setDoc, collection, getDocs, deleteDoc, serverTimestamp, __app_id } from '../firebase-init.js';

// Hook personalizado para manejar la funcionalidad de WebRTC (streaming).
export const useWebRTC = (
    userId,
    userName,
    activeChannel,
    showMessage,
    setIsLoading,
    localStream,
    setLocalStream,
    remoteStream,
    setRemoteStream,
    isStreaming,
    setIsStreaming,
    isReceivingStream,
    setIsReceivingStream,
    isStreamer,
    setIsStreamer,
    isStartingStream,
    setIsStartingStream,
    peerConnectionRef, // Ref para la instancia de RTCPeerConnection.
    localVideoRef, // Ref para el elemento de video local.
    remoteVideoRef // Ref para el elemento de video remoto.
) => {

    // Función para solicitar permisos de medios (cámara y micrófono).
    const requestMediaPermissions = React.useCallback(async () => {
        try {
            console.log("DEBUG PROFUNDO: Solicitando permisos de medios explícitamente...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            // Detiene explícitamente las pistas para liberar la cámara/micrófono después de la verificación de permisos.
            stream.getTracks().forEach(track => track.stop());
            showMessage("¡Permisos de cámara y micrófono concedidos!", 'success');
            console.log("DEBUG PROFUNDO: Permisos de medios concedidos exitosamente.");
        } catch (error) {
            console.error(`DEBUG PROFUNDO: Error solicitando permisos de medios: Nombre: ${error.name}, Mensaje: ${error.message}`, error);
            showMessage(`Error solicitando permisos de medios: ${error.message}. Por favor, revisa la configuración de tu navegador.`, 'error');
        }
    }, [showMessage]);

    // Función para detener la recepción de un stream (como espectador).
    const stopReceivingStream = React.useCallback(() => {
        console.log("DEBUG PROFUNDO: stopReceivingStream - Iniciado.");
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            setRemoteStream(null);
            console.log("DEBUG PROFUNDO: Pistas de stream remoto detenidas y limpiadas.");
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.load();
            console.log("DEBUG PROFUNDO: srcObject del elemento de video remoto limpiado.");
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
            console.log("DEBUG PROFUNDO: PeerConnection cerrada.");
        }
        setIsReceivingStream(false);
        setIsLoading(false); // Oculta el spinner de carga si estaba mostrando para la recepción.
        console.log("DEBUG PROFUNDO: stopReceivingStream - Completado. isReceivingStream establecido en falso.");
    }, [remoteStream, remoteVideoRef, peerConnectionRef, setIsLoading, setIsReceivingStream]);

    // Función para iniciar la recepción de un stream (como espectador).
    const receiveStream = React.useCallback(async (channelNameForStream, streamerId) => {
        console.log("DEBUG PROFUNDO: receiveStream - Iniciado. ID del Streamer:", streamerId, "Canal:", channelNameForStream);
        if (!db || !userId || !channelNameForStream || !streamerId) {
            showMessage("Base de datos o información de usuario no lista. No se puede recibir el stream.", 'error');
            console.warn("DEBUG PROFUNDO: receiveStream - DB, userId o streamerId no listos.");
            return;
        }

        if (isReceivingStream || isStartingStream || isStreaming) {
            console.warn("DEBUG PROFUNDO: Ya recibiendo o iniciando stream. Abortando receiveStream.");
            return;
        }

        setIsReceivingStream(true);
        setIsLoading(true);
        console.log("DEBUG PROFUNDO: receiveStream - isReceivingStream establecido en true. isLoading establecido en true.");

        let pcInstance;

        try {
            const servers = {
                iceServers: [
                    {
                        urls: "stun:stun.l.google.com:19302" // Servidor STUN público para depuración.
                    }
                ]
            };
            console.log("DEBUG PROFUNDO: RTCPeerConnection inicializada para recibir con servidores ICE (SOLO STUN DEPURACIÓN):", servers);
            pcInstance = new RTCPeerConnection(servers);
            peerConnectionRef.current = pcInstance;
            console.log("DEBUG PROFUNDO: receiveStream - Nueva PeerConnection creada y asignada a la ref. Ref actual:", peerConnectionRef.current);
            console.log(`DEBUG PROFUNDO: Inmediatamente después de la creación de PC (RECEPTOR) - signalingState: ${peerConnectionRef.current.signalingState}, iceGatheringState: ${peerConnectionRef.current.iceGatheringState}`);

            if (!peerConnectionRef.current) {
                console.error("DEBUG PROFUNDO: PeerConnection es nula después de la creación en receiveStream. Abortando.");
                showMessage("Error interno: PeerConnection no disponible.", 'error');
                setIsReceivingStream(false);
                setIsLoading(false);
                return;
            }

            peerConnectionRef.current.onicegatheringstatechange = () => {
                console.log(`DEBUG PROFUNDO: PeerConnection iceGatheringState cambió a: ${peerConnectionRef.current.iceGatheringState}`);
            };
            peerConnectionRef.current.onconnectionstatechange = () => {
                console.log(`DEBUG PROFUNDO: Estado de RTCPeerConnection (espectador): ${peerConnectionRef.current.connectionState}`);
                if (peerConnectionRef.current.connectionState === 'disconnected' || peerConnectionRef.current.connectionState === 'failed' || peerConnectionRef.current.connectionState === 'closed') {
                    console.log("DEBUG PROFUNDO: PeerConnection desconectada/fallida/cerrada (espectador). Deteniendo la recepción del stream.");
                    showMessage("Stream desconectado debido a un error de conexión.", 'error');
                    setTimeout(() => stopReceivingStream(), 500);
                }
            };

            peerConnectionRef.current.ontrack = (event) => {
                console.log("DEBUG PROFUNDO: Pista remota recibida para el espectador:", event.streams[0]);
                console.log(`DEBUG PROFUNDO: Stream remoto activo: ${event.streams[0].active}, pistas: ${event.streams[0].getTracks().length}`);
                const videoTracks = event.streams[0].getVideoTracks();
                if (videoTracks.length > 0) {
                    const videoTrack = videoTracks[0];
                    console.log(`DEBUG PROFUNDO: Estado de la pista de video remoto: ${videoTrack.readyState}, habilitado: ${videoTrack.enabled}, silenciado: ${videoTrack.muted}`);
                    if (videoTrack.getSettings()) {
                        console.log(`DEBUG PROFUNDO: Configuración de la pista de video remoto: Ancho: ${videoTrack.getSettings().width}, Alto: ${videoTrack.getSettings().height}, Velocidad de fotogramas: ${videoTrack.getSettings().frameRate}`);
                    }
                }
                setRemoteStream(event.streams[0]);
            };

            const normalizedChannelName = channelNameForStream.toLowerCase();
            const webrtcDocRef = doc(db, `artifacts/${__app_id}/public/data/channels/${normalizedChannelName}/webrtc_signaling`, 'webrtc_data');
            const candidatesCollectionRef = collection(webrtcDocRef, 'candidates');

            peerConnectionRef.current.onicecandidate = async (event) => {
                if (event.candidate) {
                    console.log("DEBUG PROFUNDO: Candidato ICE encontrado para el espectador:", event.candidate);
                    try {
                        await addDoc(candidatesCollectionRef, {
                            ...event.candidate.toJSON(),
                            senderId: userId
                        });
                        console.log("DEBUG PROFUNDO: Candidato ICE guardado en Firestore para el espectador:", event.candidate.toJSON());
                    } catch (e) {
                        console.error("DEBUG PROFUNDO: Error guardando candidato ICE en Firestore (espectador):", e);
                        showMessage("Error al guardar candidato ICE.", 'error');
                    }
                } else {
                    console.log("DEBUG PROFUNDO: Todos los candidatos ICE recopilados para el espectador.");
                }
            };

            const unsubscribeOffer = onSnapshot(webrtcDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.offer && data.offer.senderId === streamerId && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
                        const offer = new RTCSessionDescription(data.offer);
                        console.log("DEBUG PROFUNDO: Oferta recibida de Firestore para el espectador:", offer);
                        console.log("DEBUG PROFUNDO: SDP de la descripción remota del espectador (oferta recibida):", offer.sdp);
                        console.log(`DEBUG PROFUNDO: signalingState de PC del espectador ANTES de setRemoteDescription(offer): ${peerConnectionRef.current.signalingState}`);
                        try {
                            await peerConnectionRef.current.setRemoteDescription(offer);
                            console.log("DEBUG PROFUNDO: Descripción remota (oferta) establecida para el espectador.");
                            console.log(`DEBUG PROFUNDO: signalingState de PC del espectador DESPUÉS de setRemoteDescription(offer): ${peerConnectionRef.current.signalingState}`);

                            const answer = await peerConnectionRef.current.createAnswer();
                            console.log("DEBUG PROFUNDO: Respuesta creada para el espectador:", answer);
                            console.log(`DEBUG PROFUNDO: signalingState de PC del espectador ANTES de setLocalDescription(answer): ${peerConnectionRef.current.signalingState}`);
                            await peerConnectionRef.current.setLocalDescription(answer);
                            console.log("DEBUG PROFUNDO: Descripción local (respuesta) establecida para el espectador. Objeto de descripción local:", peerConnectionRef.current.localDescription);
                            console.log("DEBUG PROFUNDO: SDP de la descripción local del espectador (respuesta):", peerConnectionRef.current.localDescription.sdp);
                            console.log(`DEBUG PROFUNDO: signalingState de PC del espectador DESPUÉS de setLocalDescription(answer): ${peerConnectionRef.current.signalingState}`);

                            await setDoc(webrtcDocRef, {
                                answer: {
                                    sdp: peerConnectionRef.current.localDescription.sdp,
                                    type: peerConnectionRef.current.localDescription.type,
                                    receiverId: userId,
                                    receiverUserName: userName,
                                    timestamp: serverTimestamp()
                                }
                            }, { merge: true });
                            console.log("DEBUG PROFUNDO: Respuesta de WebRTC guardada en Firestore para el espectador:", peerConnectionRef.current.localDescription.toJSON());

                            const candidateSnapshot = await getDocs(candidatesCollectionRef);
                            candidateSnapshot.forEach(async (candidateDoc) => {
                                if (candidateDoc.exists() && candidateDoc.data().senderId === streamerId && peerConnectionRef.current) {
                                    try {
                                        const candidate = new RTCIceCandidate(candidateDoc.data());
                                        await peerConnectionRef.current.addIceCandidate(candidate);
                                        console.log("DEBUG PROFUNDO: Candidato ICE del streamer añadido para el espectador:", candidate);
                                        await deleteDoc(doc(candidatesCollectionRef, candidateDoc.id));
                                    } catch (e) {
                                        console.error("DEBUG PROFUNDO: Error añadiendo candidato ICE del streamer para el espectador (desde snapshot):", e);
                                    }
                                }
                            });
                            showMessage("¡Recibiendo stream!", 'success');
                        } catch (e) {
                            console.error("DEBUG PROFUNDO: Error configurando descripción remota/local o guardando respuesta (espectador):", e);
                            showMessage("Error al procesar oferta/respuesta del stream.", 'error');
                        }
                    }
                }
            }, (error) => {
                console.error("DEBUG PROFUNDO: Error escuchando oferta para el espectador:", error);
                showMessage("Error al escuchar la oferta del stream.", 'error');
            });

            const streamerCandidatesListener = onSnapshot(candidatesCollectionRef, (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type === "added") {
                        const candidateData = change.doc.data();
                        if (candidateData.senderId === streamerId && peerConnectionRef.current) {
                            try {
                                const candidate = new RTCIceCandidate(candidateData);
                                if (peerConnectionRef.current.remoteDescription) {
                                    await peerConnectionRef.current.addIceCandidate(candidate);
                                    console.log("DEBUG PROFUNDO: Candidato del streamer añadido (a través del listener) para el espectador:", candidate);
                                    await deleteDoc(doc(candidatesCollectionRef, change.doc.id));
                                } else {
                                    console.warn("DEBUG PROFUNDO: Descripción remota aún no establecida, posponiendo candidato del streamer para el espectador:", candidate);
                                }
                            } catch (e) {
                                console.error("DEBUG PROFUNDO: Error añadiendo candidato del streamer (a través del listener) para el espectador:", e);
                            }
                        }
                    }
                });
            }, (error) => {
                console.error("DEBUG PROFUNDO: Error escuchando candidatos del streamer para el espectador:", error);
                showMessage("Error al escuchar candidatos del stream.", 'error');
            });

            return () => {
                unsubscribeOffer();
                streamerCandidatesListener();
            };

        } catch (error) {
            console.error("DEBUG PROFUNDO: Error recibiendo stream:", error);
            showMessage("Error al recibir el stream: " + error.message, 'error');
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            setRemoteStream(null);
            setIsReceivingStream(false);
        } finally {
            setIsLoading(false);
            console.log("DEBUG PROFUNDO: receiveStream - Bloque finally ejecutado. isLoading establecido en falso.");
        }
    }, [db, userId, userName, showMessage, isReceivingStream, isStartingStream, isStreaming, peerConnectionRef, remoteVideoRef, setIsLoading, setRemoteStream, stopReceivingStream]);

    // Función para detener el streaming (como streamer).
    const stopStreaming = React.useCallback(async () => {
        console.log("DEBUG PROFUNDO: stopStreaming - Iniciado.");
        setIsLoading(true);
        try {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                setLocalStream(null);
                console.log("DEBUG PROFUNDO: Pistas de stream local detenidas y limpiadas.");
            }
            if (remoteStream) {
                remoteStream.getTracks().forEach(track => track.stop());
                setRemoteStream(null);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = null;
                    remoteVideoRef.current.muted = true;
                    remoteVideoRef.current.load();
                }
                console.log("DEBUG PROFUNDO: Pistas de stream remoto detenidas y limpiadas (durante stopStreaming).");
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
                console.log("DEBUG PROFUNDO: PeerConnection cerrada.");
            }

            // Actualiza el estado del canal en Firestore para indicar que no hay streaming.
            if (activeChannel && db && userId && isStreamer) {
                const normalizedActiveChannel = activeChannel.name.toLowerCase();
                const channelDocRef = doc(db, `artifacts/${__app_id}/public/data/channels`, normalizedActiveChannel);
                await setDoc(channelDocRef, {
                    isStreaming: false,
                    streamerId: null,
                    streamerUserName: null,
                    lastActivity: serverTimestamp()
                }, { merge: true });
                console.log("DEBUG PROFUNDO: Estado del canal actualizado en Firestore: isStreaming=false.");

                // Limpia los datos de señalización de WebRTC para este canal.
                const webrtcDocRef = doc(db, `artifacts/${__app_id}/public/data/channels/${normalizedActiveChannel}/webrtc_signaling`, 'webrtc_data');
                const webrtcDocSnap = await getDoc(webrtcDocRef);
                if (webrtcDocSnap.exists()) {
                    const candidatesColRef = collection(webrtcDocRef, 'candidates');
                    const candidatesSnapshot = await getDocs(candidatesColRef);
                    const deleteCandidatePromises = [];
                    candidatesSnapshot.forEach(candidateDoc => {
                        deleteCandidatePromises.push(deleteDoc(doc(candidatesColRef, candidateDoc.id)));
                    });
                    console.log(`DEBUG PROFUNDO: stopStreaming - Eliminando ${deleteCandidatePromises.length} candidatos de WebRTC.`);
                    await Promise.all(deleteCandidatePromises);

                    await deleteDoc(webrtcDocRef);
                    console.log("DEBUG PROFUNDO: stopStreaming - Datos de señalización de WebRTC eliminados de Firestore.");
                }
            }

            setIsStreaming(false);
            setIsStreamer(false);
            showMessage("Stream detenido correctamente.", 'info');
            console.log("DEBUG PROFUNDO: Stream detenido exitosamente.");

        } catch (error) {
            console.error("DEBUG PROFUNDO: Error deteniendo stream:", error);
            showMessage("Error al detener el stream: " + error.message, 'error');
        } finally {
            setIsLoading(false);
            console.log("DEBUG PROFUNDO: stopStreaming - Bloque finally ejecutado.");
        }
    }, [localStream, remoteStream, activeChannel, db, userId, isStreamer, showMessage, setIsLoading, setLocalStream, setRemoteStream, setIsStreaming, setIsStreamer, peerConnectionRef, remoteVideoRef]);

    // Función para iniciar el streaming (como streamer).
    const startStreaming = React.useCallback(async () => {
        console.log("DEBUG PROFUNDO: startStreaming - Iniciado.");

        const currentAuthUser = auth.currentUser;
        const currentAuthUserId = currentAuthUser ? currentAuthUser.uid : null;

        if (!db || !currentAuthUserId || !activeChannel || !userName) {
            showMessage("Base de datos o información de usuario no lista. No se puede iniciar el stream.", 'error');
            console.warn("DEBUG PROFUNDO: startStreaming - DB, userId o userName no listos.");
            return;
        }

        if (isStartingStream || isStreaming || isReceivingStream) {
            console.warn("DEBUG PROFUNDO: Stream ya activo o en proceso de inicio. Abortando startStreaming.");
            showMessage("Ya hay un stream activo o en proceso de inicio.", 'info');
            return;
        }

        setIsStartingStream(true);
        setIsLoading(true);
        console.log("DEBUG PROFUNDO: startStreaming - isStartingStream establecido en true. isLoading establecido en true.");

        let pcInstance;
        let stream;

        try {
            console.log("DEBUG PROFUNDO: Solicitando permisos de medios explícitamente...");
            const mediaPermissionStatus = await navigator.permissions.query({ name: 'camera' });
            const audioPermissionStatus = await navigator.permissions.query({ name: 'microphone' });

            if (mediaPermissionStatus.state === 'granted' && audioPermissionStatus.state === 'granted') {
                console.log("DEBUG PROFUNDO: Permisos de medios concedidos exitosamente.");
            } else {
                console.warn("DEBUG PROFUNDO: Permisos de medios no concedidos explícitamente, getUserMedia solicitará.");
            }

            console.log("DEBUG PROFUNDO: Intentando obtener medios de usuario (video y audio).");
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log(`DEBUG PROFUNDO: Stream obtenido de getUserMedia. Activo: ${stream.active}, ReadyState: ${stream.readyState}, Pistas: ${stream.getTracks().length}`);

            if (!stream.active) {
                const errorMessage = "El stream de medios no está activo después de getUserMedia. Por favor, revisa tu cámara/micrófono y la configuración del navegador.";
                console.error("DEBUG PROFUNDO: " + errorMessage);
                showMessage(errorMessage, 'error');
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                setIsLoading(false);
                setIsStartingStream(false);
                return;
            }

            setLocalStream(stream);

            const servers = {
                iceServers: [
                    {
                        urls: "stun:stun.l.google.com:19302"
                    }
                ]
            };
            console.log("DEBUG PROFUNDO: RTCPeerConnection inicializada con servidores ICE (SOLO STUN DEPURACIÓN):", servers);
            pcInstance = new RTCPeerConnection(servers);
            peerConnectionRef.current = pcInstance;
            console.log("DEBUG PROFUNDO: startStreaming - Nueva PeerConnection creada y asignada a la ref. Ref actual:", peerConnectionRef.current);
            console.log(`DEBUG PROFUNDO: Inmediatamente después de la creación de PC (STREAMER) - signalingState: ${peerConnectionRef.current.signalingState}, iceGatheringState: ${peerConnectionRef.current.iceGatheringState}`);

            if (!peerConnectionRef.current) {
                console.error("DEBUG PROFUNDO: PeerConnection es nula después de la creación en startStreaming. Abortando.");
                showMessage("Error interno: PeerConnection no disponible.", 'error');
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                setIsLoading(false);
                setIsStartingStream(false);
                return;
            }

            peerConnectionRef.current.onnegotiationneeded = () => {
                console.log("DEBUG PROFUNDO: Evento onnegotiationneeded de PeerConnection disparado.");
            };

            peerConnectionRef.current.onicegatheringstatechange = () => {
                console.log(`DEBUG PROFUNDO: PeerConnection iceGatheringState cambió a: ${peerConnectionRef.current.iceGatheringState}`);
            };
            peerConnectionRef.current.onconnectionstatechange = () => {
                console.log(`DEBUG PROFUNDO: Estado de RTCPeerConnection (streamer): ${peerConnectionRef.current.connectionState}`);
                if (peerConnectionRef.current.connectionState === 'disconnected' || peerConnectionRef.current.connectionState === 'failed' || peerConnectionRef.current.connectionState === 'closed') {
                    console.log("DEBUG PROFUNDO: PeerConnection desconectada/fallida/cerrada (streamer). Deteniendo stream.");
                    showMessage("Stream desconectado debido a un error de conexión.", 'error');
                    setTimeout(() => stopStreaming(), 500);
                }
            };

            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream);
                console.log("DEBUG PROFUNDO: Pista local añadida a la conexión de pares:", track.kind);
                if (track.kind === 'video') {
                    console.log(`DEBUG PROFUNDO: Estado de la pista de video local: ${track.readyState}, habilitado: ${track.enabled}, silenciado: ${track.muted}`);
                    if (track.getSettings()) {
                        console.log(`DEBUG PROFUNDO: Configuración de la pista de video local: Ancho: ${track.getSettings().width}, Alto: ${track.getSettings().height}, Velocidad de fotogramas: ${track.getSettings().frameRate}`);
                    }
                }
            });

            console.log("DEBUG PROFUNDO: Añadiendo un pequeño retraso después de añadir las pistas...");
            await new Promise(resolve => setTimeout(resolve, 200));

            const normalizedActiveChannel = activeChannel.name.toLowerCase();

            const webrtcDocRef = doc(db, `artifacts/${__app_id}/public/data/channels/${normalizedActiveChannel}/webrtc_signaling`, 'webrtc_data');
            const candidatesCollectionRef = collection(webrtcDocRef, 'candidates');

            peerConnectionRef.current.onicecandidate = async (event) => {
                if (event.candidate) {
                    console.log("DEBUG PROFUNDO: Candidato ICE encontrado:", event.candidate);
                    try {
                        await addDoc(candidatesCollectionRef, {
                            ...event.candidate.toJSON(),
                            senderId: currentAuthUserId
                        });
                        console.log("DEBUG PROFUNDO: Candidato ICE guardado en Firestore:", event.candidate.toJSON());
                    } catch (e) {
                        console.error("DEBUG PROFUNDO: Error guardando candidato ICE en Firestore (streamer):", e);
                        showMessage("Error al guardar candidato ICE.", 'error');
                    }
                } else {
                    console.log("DEBUG PROFUNDO: Todos los candidatos ICE recopilados.");
                }
            };

            peerConnectionRef.current.ontrack = (event) => {
                console.log("DEBUG PROFUNDO: Pista remota recibida:", event.streams[0]);
                setRemoteStream(event.streams[0]);
            };

            console.log("DEBUG PROFUNDO: ANTES de createOffer. signalingState actual:", peerConnectionRef.current.signalingState);
            console.log("DEBUG PROFUNDO: Transceptores:", peerConnectionRef.current.getTransceivers());
            console.log(`DEBUG PROFUNDO: Estado del Stream de Medios - activo: ${stream.active}, readyState: ${stream.readyState}, Pistas: ${stream.getTracks().length}`);

            let offer;
            const maxReadinessRetries = 20;
            const readinessRetryDelayMs = 100;

            for (let i = 0; i < maxReadinessRetries; i++) {
                console.log(`DEBUG PROFUNDO: Comprobando la preparación del stream (Intento ${i + 1}/${maxReadinessRetries})...`);

                if (!stream.active || stream.getTracks().length === 0) {
                     const errorMessage = "El stream de medios no está activo o no tiene pistas. Activo: " + stream.active + ", Pistas: " + stream.getTracks().length + ".";
                     console.warn("DEBUG PROFUNDO: " + errorMessage);
                     if (i === maxReadinessRetries - 1) {
                         showMessage(errorMessage + " Por favor, revisa tu cámara/micrófono.", 'error');
                         throw new Error(errorMessage);
                     }
                     await new Promise(resolve => setTimeout(resolve, readinessRetryDelayMs));
                     continue;
                }

                const allTracksReady = stream.getTracks().every(track => {
                    console.log(`DEBUG PROFUNDO: readyState de la pista ${track.kind}: ${track.readyState}`);
                    return track.readyState === 'live';
                });

                if (allTracksReady) {
                    console.log("DEBUG PROFUNDO: Todas las pistas de medios individuales están listas.");
                    console.log(`DEBUG PROFUNDO: readyState final del Stream de Medios (para información): ${stream.readyState}`);
                    break;
                } else {
                    const errorMessage = "No todas las pistas de medios están listas. Esperando readyState 'live'.";
                    console.warn("DEBUG PROFUNDO: " + errorMessage);
                    if (i === maxReadinessRetries - 1) {
                        showMessage(errorMessage + " Por favor, asegúrate de que tu cámara/micrófono estén completamente inicializados.", 'error');
                        throw new Error(errorMessage);
                    }
                    await new Promise(resolve => setTimeout(resolve, readinessRetryDelayMs));
                }
            }

            if (!peerConnectionRef.current || peerConnectionRef.current.signalingState === 'closed') {
                const errorMessage = "PeerConnection está cerrada o es nula. No se puede crear la oferta.";
                console.error("DEBUG PROFUNDO: " + errorMessage);
                showMessage(errorMessage, 'error');
                return;
            }

            const createOfferPromise = peerConnectionRef.current.createOffer();
            const createOfferTimeout = new Promise((resolve, reject) =>
                setTimeout(() => reject(new Error('createOffer timed out')), 20000)
            );

            try {
                console.log("DEBUG PROFUNDO: Intentando crear oferta (con timeout). Esperando Promise.race.");
                offer = await Promise.race([createOfferPromise, createOfferTimeout]);
                console.log("DEBUG PROFUNDO: DESPUÉS de createOffer. Oferta creada:", offer);
            } catch (createOfferError) {
                console.error(`DEBUG PROFUNDO: Error creando oferta (WebRTC): Nombre: ${createOfferError.name}, Mensaje: ${createOfferError.message}`, createOfferError);
                showMessage(`Error al iniciar stream (Oferta WebRTC): ${createOfferError.message}. Por favor, verifica los permisos de cámara/micrófono.`, 'error');
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                    peerConnectionRef.current = null;
                }
                setLocalStream(null);
                setIsStreaming(false);
                setIsStreamer(false);
                setIsLoading(false);
                setIsStartingStream(false);
                return;
            }

            const setLocalDescriptionPromise = peerConnectionRef.current.setLocalDescription(offer);
            const setLocalDescriptionTimeout = new Promise((resolve, reject) =>
                setTimeout(() => reject(new Error('setLocalDescription timed out')), 15000)
            );

            try {
                console.log("DEBUG PROFUNDO: Intentando establecer la descripción local (con timeout). Esperando Promise.race.");
                await Promise.race([setLocalDescriptionPromise, setLocalDescriptionTimeout]);
                console.log("DEBUG PROFUNDO: Oferta establecida como descripción local. Objeto de descripción local:", peerConnectionRef.current.localDescription);
                console.log(`DEBUG PROFUNDO: Estado de PeerConnection DESPUÉS de setLocalDescription - signalingState: ${peerConnectionRef.current.signalingState}, iceGatheringState: ${peerConnectionRef.current.iceGatheringState}`);
                showMessage("¡Descripción local establecida exitosamente!", 'success');

                await setDoc(webrtcDocRef, {
                    offer: {
                        sdp: peerConnectionRef.current.localDescription.sdp,
                        type: peerConnectionRef.current.localDescription.type,
                        senderId: currentAuthUserId,
                        senderUserName: userName,
                        timestamp: serverTimestamp()
                    }
                }, { merge: true });
                console.log("DEBUG PROFUNDO: Oferta de WebRTC guardada en Firestore como campo en webrtc_data:", peerConnectionRef.current.localDescription.toJSON());

                const channelDocRef = doc(db, `artifacts/${__app_id}/public/data/channels`, normalizedActiveChannel);
                await setDoc(channelDocRef, {
                    isStreaming: true,
                    streamerId: currentAuthUserId,
                    streamerUserName: userName,
                    lastActivity: serverTimestamp()
                }, { merge: true });
                console.log("DEBUG PROFUNDO: Estado del canal actualizado en Firestore: isStreaming=true.");

                setIsStreaming(true);
                setIsStreamer(true);
                showMessage("¡Stream iniciado correctamente!", 'success');
                console.log("DEBUG PROFUNDO: Stream iniciado exitosamente. isStreaming=true, isStreamer=true.");

            } catch (setLocalDescError) {
                console.error(`DEBUG PROFUNDO: Error al establecer la descripción local del stream (WebRTC): Nombre: ${setLocalDescError.name}, Mensaje: ${setLocalDescError.message}`, setLocalDescError);
                showMessage(`Error al establecer la descripción local del stream: ${setLocalDescError.message}.`, 'error');
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
                if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                    peerConnectionRef.current = null;
                }
                setLocalStream(null);
                setIsStreaming(false);
                setIsStreamer(false);
                setIsLoading(false);
                setIsStartingStream(false);
                return;
            }

            const unsubscribeAnswer = onSnapshot(webrtcDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.answer && data.answer.receiverId === currentAuthUserId && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
                        const answer = new RTCSessionDescription(data.answer);
                        console.log("DEBUG PROFUNDO: Respuesta recibida de Firestore:", answer);
                        console.log(`DEBUG PROFUNDO: signalingState de PC del streamer ANTES de setRemoteDescription(answer): ${peerConnectionRef.current.signalingState}`);
                        try {
                            await peerConnectionRef.current.setRemoteDescription(answer);
                            console.log("DEBUG PROFUNDO: Descripción remota (respuesta) establecida.");
                            console.log(`DEBUG PROFUNDO: signalingState de PC del streamer DESPUÉS de setRemoteDescription(answer): ${peerConnectionRef.current.signalingState}`);
                            showMessage("Respuesta de espectador recibida.", 'info');

                            const candidateSnapshot = await getDocs(collection(webrtcDocRef, 'candidates'));
                            candidateSnapshot.forEach(async (candidateDoc) => {
                                if (candidateDoc.exists() && candidateDoc.data().senderId !== currentAuthUserId && peerConnectionRef.current) {
                                    try {
                                        const candidate = new RTCIceCandidate(candidateDoc.data());
                                        await peerConnectionRef.current.addIceCandidate(candidate);
                                        console.log("DEBUG PROFUNDO: Candidato ICE del espectador añadido:", candidate);
                                        await deleteDoc(doc(collection(webrtcDocRef, 'candidates'), candidateDoc.id));
                                    } catch (e) {
                                        console.error("DEBUG PROFUNDO: Error añadiendo candidato ICE del espectador (desde snapshot):", e);
                                    }
                                }
                            });
                        } catch (e) {
                            console.error("DEBUG PROFUNDO: Error configurando descripción remota (streamer, respuesta):", e);
                            showMessage("Error al procesar respuesta del espectador.", 'error');
                        }
                    }
                }
            }, (error) => {
                console.error("DEBUG PROFUNDO: Error escuchando respuesta:", error);
                showMessage("Error al escuchar la respuesta del stream.", 'error');
            });

            const channelCandidatesListener = onSnapshot(candidatesCollectionRef, (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type === "added") {
                        const candidateData = change.doc.data();
                        if (candidateData.senderId !== currentAuthUserId && peerConnectionRef.current) {
                            try {
                                const candidate = new RTCIceCandidate(candidateData);
                                if (peerConnectionRef.current.remoteDescription) {
                                    await peerConnectionRef.current.addIceCandidate(candidate);
                                    console.log("DEBUG PROFUNDO: Candidato del espectador añadido (a través del listener):", candidate);
                                    await deleteDoc(doc(candidatesCollectionRef, change.doc.id));
                                } else {
                                    console.warn("DEBUG PROFUNDO: Descripción remota aún no establecida, posponiendo candidato del espectador:", candidate);
                                }
                            } catch (e) {
                                console.error("DEBUG PROFUNDO: Error añadiendo candidato del espectador (a través del listener):", e);
                            }
                        }
                    }
                });
            }, (error) => {
                console.error("DEBUG PROFUNDO: Error escuchando candidatos del espectador:", error);
                showMessage("Error al escuchar candidatos del espectador.", 'error');
            });

            return () => {
                unsubscribeAnswer();
                channelCandidatesListener();
            };

        } catch (error) {
            console.error("DEBUG PROFUNDO: Error iniciando stream:", error);
            showMessage("Error al iniciar el stream: " + error.message, 'error');
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            setLocalStream(null);
            setRemoteStream(null);
            setIsStreaming(false);
            setIsReceivingStream(false);
            setIsStreamer(false);
        } finally {
            setIsStartingStream(false);
            setIsLoading(false);
            console.log("DEBUG PROFUNDO: startStreaming - Bloque finally ejecutado. isStartingStream establecido en falso. isLoading establecido en falso.");
        }
    }, [userId, userName, activeChannel, showMessage, setIsLoading, localStream, setLocalStream, remoteStream, setRemoteStream, isStreaming, setIsStreaming, isReceivingStream, setIsReceivingStream, isStreamer, setIsStreamer, isStartingStream, setIsStartingStream, peerConnectionRef, localVideoRef, remoteVideoRef, db, auth, stopStreaming]);

    // Efecto para asignar localStream al elemento de video local.
    React.useEffect(() => {
        console.log("DEBUG PROFUNDO: useEffect para localStream disparado. localStream:", localStream, "localVideoRef.current:", localVideoRef.current, "isStreamer:", isStreamer);
        if (localVideoRef.current && localStream && isStreamer) {
            localVideoRef.current.srcObject = localStream;
            console.log("DEBUG PROFUNDO: Stream de video local adjunto al elemento de video a través de useEffect.");
            localVideoRef.current.play().catch(e => console.error("DEBUG PROFUNDO: Error reproduciendo video local:", e));
        } else if (!localVideoRef.current && localStream && isStreamer) {
            console.warn("DEBUG PROFUNDO: localVideoRef.current es nulo en useEffect para localStream, pero localStream existe y isStreamer es true. Esto podría indicar un retraso en el renderizado.");
        }
    }, [localStream, isStreamer, localVideoRef]);

    // Efecto para asignar remoteStream al elemento de video remoto.
    React.useEffect(() => {
        console.log("DEBUG PROFUNDO: useEffect para remoteStream disparado. remoteStream:", remoteStream, "remoteVideoRef.current:", remoteVideoRef.current, "isReceivingStream:", isReceivingStream);
        if (remoteVideoRef.current && remoteStream && isReceivingStream) {
            if (remoteVideoRef.current.srcObject !== remoteStream) {
                console.log("DEBUG PROFUNDO: Asignando stream remoto al elemento de video a través de useEffect.");
                remoteVideoRef.current.srcObject = remoteStream;

                remoteVideoRef.current.onloadedmetadata = () => {
                    console.log("DEBUG PROFUNDO: Evento loadedmetadata de video remoto disparado (desde useEffect).");
                    if (remoteVideoRef.current.paused || remoteVideoRef.current.ended || remoteVideoRef.current.readyState === 0) {
                        console.log("DEBUG PROFUNDO: Intentando reproducir video remoto (silenciado) después de loadedmetadata (desde useEffect).");
                        remoteVideoRef.current.muted = true;
                        remoteVideoRef.current.play().then(() => {
                            console.log("DEBUG PROFUNDO: Video remoto comenzó a reproducirse (silenciado) desde useEffect/loadedmetadata.");
                            setIsLoading(false);
                            showMessage("Uniéndote al stream (silenciado). Por favor, haz clic para activar el audio.", 'info');
                        }).catch(error => {
                            console.error(`DEBUG PROFUNDO: Error intentando reproducir video remoto desde useEffect/loadedmetadata: Nombre: ${error.name}, Mensaje: ${error.message}`, error);
                            showMessage("Error al reproducir el video del stream. Habilite la reproducción automática o haga clic para reproducir.", 'error');
                            setIsLoading(false);
                        });
                    } else {
                        console.log("DEBUG PROFUNDO: Video remoto ya reproduciéndose o no en un estado para ser reproducido automáticamente (desde useEffect/loadedmetadata).");
                        setIsLoading(false);
                    }
                    remoteVideoRef.current.onloadedmetadata = null;
                };
            } else {
                console.log("DEBUG PROFUNDO: remoteVideoRef.current.srcObject ya es el mismo stream (desde useEffect).");
                if (remoteVideoRef.current.paused || remoteVideoRef.current.ended || remoteVideoRef.current.readyState === 0) {
                     console.log("DEBUG PROFUNDO: Intentando reproducir video remoto existente (silenciado) desde useEffect.");
                     remoteVideoRef.current.muted = true;
                     remoteVideoRef.current.play().then(() => {
                         console.log("DEBUG PROFUNDO: Video remoto existente comenzó a reproducirse (silenciado) desde useEffect.");
                         setIsLoading(false);
                         showMessage("Uniéndote al stream (silenciado). Por favor, haz clic para activar el audio.", 'info');
                     }).catch(error => {
                         console.error(`DEBUG PROFUNDO: Error reproduciendo video remoto existente desde useEffect: Nombre: ${error.name}, Mensaje: ${error.message}`, error);
                         showMessage("Error al reproducir el video del stream. Habilite la reproducción automática o haga clic para reproducir.", 'error');
                         setIsLoading(false);
                     });
                } else {
                    console.log("DEBUG PROFUNDO: Video remoto ya reproduciéndose o no en un estado para ser reproducido automáticamente (stream existente desde useEffect).");
                    setIsLoading(false);
                }
            }
        } else if (!remoteVideoRef.current && remoteStream && isReceivingStream) {
            console.warn("DEBUG PROFUNDO: remoteVideoRef.current es nulo en useEffect para remoteStream, pero remoteStream existe y isReceivingStream es true. Esto podría indicar un retraso en el renderizado.");
        }
    }, [remoteStream, isReceivingStream, showMessage, setIsLoading, remoteVideoRef]);

    return {
        requestMediaPermissions,
        stopReceivingStream,
        receiveStream,
        stopStreaming,
        startStreaming
    };
};
