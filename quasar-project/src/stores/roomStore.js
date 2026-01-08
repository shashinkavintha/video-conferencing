import { defineStore } from 'pinia'
import { Room, RoomEvent, createLocalTracks, Track } from 'livekit-client'

export const useRoomStore = defineStore('room', {
    state: () => ({
        room: null,
        localVideoTrack: null,
        localAudioTrack: null,
        remoteParticipants: [],
        isConnected: false,
        error: null,
        isMicEnabled: true,
        isCameraEnabled: true,
        isScreenSharing: false,
        messages: [],
    }),

    actions: {
        async initializeLocalTracks() {
            console.log('Initializing local tracks (robust)...')
            this.error = null
            let tracks = []

            // 1. Try Bundled Request first (updates permissions for both)
            try {
                tracks = await createLocalTracks({
                    audio: true,
                    video: { resolution: { width: 1280, height: 720 } }
                })
            } catch (bundledError) {
                console.warn('Bundled track creation failed, retrying separately:', bundledError)

                // 2. Fallback: Try Video Only
                try {
                    const videoTracks = await createLocalTracks({
                        audio: false,
                        video: { resolution: { width: 1280, height: 720 } }
                    })
                    tracks.push(...videoTracks)
                } catch (videoError) {
                    console.error('Video track failed:', videoError)
                    this.error = 'Camera Error: ' + videoError.message
                }

                // 3. Fallback: Try Audio Only
                try {
                    const audioTracks = await createLocalTracks({ audio: true, video: false })
                    tracks.push(...audioTracks)
                } catch (audioError) {
                    console.error('Audio track failed:', audioError)
                    const msg = 'Microphone Error: ' + audioError.message
                    this.error = this.error ? this.error + ' | ' + msg : msg
                }
            }

            // Assign tracks to state
            const videoTrack = tracks.find(t => t.kind === Track.Kind.Video)
            const audioTrack = tracks.find(t => t.kind === Track.Kind.Audio)

            if (videoTrack) {
                this.localVideoTrack = videoTrack
                this.isCameraEnabled = true
                console.log('Video track created')
            } else {
                this.isCameraEnabled = false
            }

            if (audioTrack) {
                this.localAudioTrack = audioTrack
                this.isMicEnabled = true
                console.log('Audio track created')
            } else {
                this.isMicEnabled = false
            }

            return tracks.length > 0
        },

        async joinRoom(roomId, participantName) {
            if (!roomId || !participantName) {
                this.error = "Missing Room ID or Name"
                return
            }

            try {
                // 1. Get Token from our Supabase Edge Function
                const response = await fetch('https://wmbteiauqzcslwnxfxwj.supabase.co/functions/v1/get-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomName: roomId, participantName }),
                })

                if (!response.ok) throw new Error('Failed to fetch token')

                const data = await response.json()
                const token = data.token
                const wsUrl = 'wss://video-conferencing-n9o307vp.livekit.cloud'

                // 2. Connect to LiveKit
                this.room = new Room()

                // Handle Room Events
                this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                    this.addParticipant(participant)
                })

                this.room.on(RoomEvent.TrackUnsubscribed, () => {
                    // Track removed
                })

                this.room.on(RoomEvent.ParticipantConnected, (participant) => {
                    this.addParticipant(participant)
                })

                this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
                    this.removeParticipant(participant)
                })

                this.room.on(RoomEvent.DataReceived, (payload, participant) => {
                    const str = new TextDecoder().decode(payload)
                    try {
                        const data = JSON.parse(str)
                        if (data.type === 'chat') {
                            this.messages.push({ ...data, isLocal: false, sender: participant.identity })
                        }
                    } catch {
                        // ignore
                    }
                })

                // Listen for Local Screen Share
                this.room.on(RoomEvent.LocalTrackPublished, (publication) => {
                    if (publication.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
                        this.isScreenSharing = true
                    }
                })

                this.room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
                    if (publication.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare) {
                        this.isScreenSharing = false
                    }
                })

                await this.room.connect(wsUrl, token)
                this.isConnected = true

                // Publish Camera & Mic
                if (this.localVideoTrack) {
                    await this.room.localParticipant.publishTrack(this.localVideoTrack)
                }
                if (this.localAudioTrack) {
                    await this.room.localParticipant.publishTrack(this.localAudioTrack)
                }

                // Add already connected participants
                this.room.remoteParticipants.forEach(participant => {
                    this.addParticipant(participant)
                })
            } catch (e) {
                console.error('Failed to connect:', e)
                this.error = e.message
            }
        },

        async leaveRoom() {
            if (this.room) {
                await this.room.disconnect()
            }
            this.room = null

            if (this.localVideoTrack) {
                this.localVideoTrack.stop()
                if (this.localVideoTrack.mediaStreamTrack) {
                    this.localVideoTrack.mediaStreamTrack.stop()
                }
                this.localVideoTrack.detach()
            }

            if (this.localAudioTrack) {
                this.localAudioTrack.stop()
                if (this.localAudioTrack.mediaStreamTrack) {
                    this.localAudioTrack.mediaStreamTrack.stop()
                }
                this.localAudioTrack.detach()
            }

            this.localVideoTrack = null
            this.localAudioTrack = null
            this.isConnected = false
            this.remoteParticipants = []
            this.isScreenSharing = false
            this.messages = [] // Clear chat on leave
        },

        async toggleMic() {
            this.isMicEnabled = !this.isMicEnabled

            if (this.room && this.room.state === 'connected') {
                await this.room.localParticipant.setMicrophoneEnabled(this.isMicEnabled)
            } else if (this.localAudioTrack) {
                this.isMicEnabled ? this.localAudioTrack.unmute() : this.localAudioTrack.mute()
            }
        },

        async toggleCamera() {
            this.isCameraEnabled = !this.isCameraEnabled

            if (this.room && this.room.state === 'connected') {
                await this.room.localParticipant.setCameraEnabled(this.isCameraEnabled)
                // Update local reference if track changes (LiveKit might create a new track)
                const trackPub = this.room.localParticipant.getTrackPublication(Track.Source.Camera)
                if (trackPub && trackPub.track) {
                    this.localVideoTrack = trackPub.track
                }
            } else if (this.localVideoTrack) {
                this.isCameraEnabled ? this.localVideoTrack.unmute() : this.localVideoTrack.mute()
            }
        },

        async toggleScreenShare() {
            if (this.room && this.room.state === 'connected') {
                try {
                    const isSharing = this.room.localParticipant.isScreenShareEnabled
                    if (isSharing) {
                        // Explicitly stop the track to ensure browser indicator clears immediately
                        const trackPub = this.room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
                        if (trackPub && trackPub.track) {
                            trackPub.track.stop()
                        }
                    }
                    await this.room.localParticipant.setScreenShareEnabled(!isSharing)
                    // State will be updated by the 'LocalTrackPublished/Unpublished' events
                } catch (e) {
                    console.error('Error toggling screen share:', e)
                    this.isScreenSharing = false // fallback
                }
            }
        },

        async sendReaction(emoji) {
            if (this.room) {
                const data = new TextEncoder().encode(JSON.stringify({ type: 'reaction', emoji }))
                await this.room.localParticipant.publishData(data, { reliable: true })
            }
        },

        async sendChatMessage(text, recipientIdentity = null) {
            if (this.room) {
                const payload = { type: 'chat', text, timestamp: Date.now(), sender: this.room.localParticipant.identity, isPrivate: !!recipientIdentity }
                const data = new TextEncoder().encode(JSON.stringify(payload))

                let destination = []
                if (recipientIdentity) {
                    const participant = this.remoteParticipants.find(p => p.identity === recipientIdentity)
                    if (participant) {
                        destination.push(participant.sid) // LiveKit publishData expects SIDs
                    } else {
                        console.warn('Recipient not found')
                        return
                    }
                }

                await this.room.localParticipant.publishData(data, { reliable: true, destination: destination.length ? destination : undefined })

                // Add to local state
                this.messages.push({ ...payload, isLocal: true, recipient: recipientIdentity || 'Everyone' })
            }
        },

        async toggleHandRaise() {
            // We use metadata for persistent states like Hand Raise
            if (this.room) {
                const currentMeta = this.room.localParticipant.metadata ? JSON.parse(this.room.localParticipant.metadata) : {}
                const newHandState = !currentMeta.handRaised

                const newMeta = { ...currentMeta, handRaised: newHandState }
                await this.room.localParticipant.setMetadata(JSON.stringify(newMeta))
            }
        },

        addParticipant(participant) {
            if (!this.remoteParticipants.find(p => p.identity === participant.identity)) {
                this.remoteParticipants.push(participant)
            }
        },

        removeParticipant(participant) {
            this.remoteParticipants = this.remoteParticipants.filter(p => p.identity !== participant.identity)
        }
    }
})
