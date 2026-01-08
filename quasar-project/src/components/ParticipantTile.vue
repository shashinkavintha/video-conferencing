<template>
  <div class="video-tile relative-position overflow-hidden" style="border-radius: 8px; background: #000; height: 100%;">
    <video ref="videoRef" autoplay playsinline class="video-feed full-width full-height object-cover" v-show="isVideoEnabled"></video>
    
    <div v-if="!isVideoEnabled" class="full-height flex flex-center bg-grey-2">
       <q-avatar size="80px" color="blue-1" text-color="primary" font-size="40px">
         {{ participant.identity ? participant.identity.charAt(0).toUpperCase() : '?' }}
       </q-avatar>
    </div>
    
    <div class="name-tag absolute-bottom-left q-ma-sm text-white bg-black-transparent q-px-sm rounded-borders" style="font-size: 12px; background: rgba(0,0,0,0.6);">
      {{ participant.identity }}
      <q-icon v-if="isMicEnabled" name="mic" size="12px" />
      <q-icon v-else name="mic_off" color="negative" size="12px" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Track } from 'livekit-client'

const props = defineProps({
  participant: {
    type: Object,
    required: true
  }
})

const videoRef = ref(null)
const isVideoEnabled = ref(false)
const isMicEnabled = ref(false)

function handleTrackSubscribed(track) {
  if (track.kind === Track.Kind.Video) {
    if (videoRef.value) {
      track.attach(videoRef.value)
      isVideoEnabled.value = true
    }
  }
  if (track.kind === Track.Kind.Audio) {
      track.attach(new Audio()) // Auto-play audio
      isMicEnabled.value = true
  }
}

function handleTrackUnsubscribed(track) {
  if (track.kind === Track.Kind.Video) {
    track.detach()
    isVideoEnabled.value = false
  }
  if (track.kind === Track.Kind.Audio) {
      isMicEnabled.value = false
  }
}

function handleTrackMuted(track) {
    if (track.kind === Track.Kind.Video) isVideoEnabled.value = false
    if (track.kind === Track.Kind.Audio) isMicEnabled.value = false
}

function handleTrackUnmuted(track) {
    if (track.kind === Track.Kind.Video) isVideoEnabled.value = true
    if (track.kind === Track.Kind.Audio) isMicEnabled.value = true
}

onMounted(() => {
    // Check initial state
    const cameraPub = props.participant.getTrackPublication(Track.Source.Camera)
    if (cameraPub && cameraPub.isSubscribed && cameraPub.track) {
        handleTrackSubscribed(cameraPub.track)
    }

    const micPub = props.participant.getTrackPublication(Track.Source.Microphone)
    if (micPub && micPub.isSubscribed && micPub.track) {
         isMicEnabled.value = true
         // Audio is usually automatically played by LiveKit if attached, handled via events mostly
    }

    // Listeners
    props.participant.on('trackSubscribed', handleTrackSubscribed)
    props.participant.on('trackUnsubscribed', handleTrackUnsubscribed)
    props.participant.on('trackMuted', handleTrackMuted)
    props.participant.on('trackUnmuted', handleTrackUnmuted)
})

onUnmounted(() => {
    props.participant.off('trackSubscribed', handleTrackSubscribed)
    props.participant.off('trackUnsubscribed', handleTrackUnsubscribed)
    props.participant.off('trackMuted', handleTrackMuted)
    props.participant.off('trackUnmuted', handleTrackUnmuted)
})
</script>

<style scoped>
.object-cover {
  object-fit: cover;
}
</style>
