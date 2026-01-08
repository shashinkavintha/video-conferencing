import { defineStore } from 'pinia'
import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack, Track } from 'livekit-client'

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
    }),

    actions: {
        async initializeLocalTracks() {
            try {
                this.localVideoTrack = await createLocalVideoTrack({
                    resolution: { width: 1280, height: 720 },
                })
                this.localAudioTrack = await createLocalAudioTrack()
                return true
            } catch (e) {
                console.error('Error getting local tracks:', e)
                this.error = 'Could not access camera or microphone.'
                return false
            }
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
            this.localVideoTrack?.stop()
            this.localAudioTrack?.stop()
            this.isConnected = false
            this.remoteParticipants = []
            this.isScreenSharing = false
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
