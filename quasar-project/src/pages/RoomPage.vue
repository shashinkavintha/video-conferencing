<template>
  <q-page class="room-container bg-black">
    
    <!-- Main Content Area -->
    <div class="main-area row relative-position">
       
       <!-- Video Area -->
       <div class="col video-area relative-position flex flex-center">
           
           <!-- Top Info Bar (Floating) -->
           <div class="absolute-top-left q-ma-md z-top">
               <q-chip 
                icon="verified_shield" 
                label="Meeting Info" 
                color="dark" 
                text-color="white" 
                clickable
                class="glass-effect"
                @click="copyMeetingLink"
               >
                 <q-tooltip>Click to Copy Invite Link</q-tooltip>
               </q-chip>
           </div>

           <!-- View Switcher (Floating) -->
           <div class="absolute-top-right q-ma-md z-top">
                <div class="glass-effect rounded-borders q-pa-xs">
                    <q-btn-group flat>
                        <q-btn size="sm" :color="viewMode === 'speaker' ? 'primary' : 'white'" flat icon="view_agenda" @click="viewMode = 'speaker'" dense />
                        <q-btn size="sm" :color="viewMode === 'gallery' ? 'primary' : 'white'" flat icon="grid_view" @click="viewMode = 'gallery'" dense />
                    </q-btn-group>
                </div>
           </div>

           <!-- Gallery View -->
           <div v-if="viewMode === 'gallery'" class="gallery-grid full-width full-height q-pa-md scroll">
                <!-- Local User -->
               <div class="video-tile">
                   <video ref="localVideoRef" autoplay playsinline muted class="video-feed" :class="{ 'mirrored': true }"></video>
                   <div v-if="!isCameraEnabled" class="avatar-placeholder absolute-center text-white">
                        <q-avatar size="100px" color="grey-9" text-color="white" font-size="40px">{{ userName.charAt(0).toUpperCase() }}</q-avatar>
                   </div>
                   <div class="name-tag">You</div>
                   <!-- Hand Raised Indicator -->
                    <div v-if="localHandRaised" class="absolute-top-left q-ma-sm">
                        <span class="text-h4">✋</span>
                    </div>
               </div>

               <!-- Remote Participants -->
               <div v-for="p in remoteParticipants" :key="p.identity" class="relative-position">
                   <ParticipantTile :participant="p" class="video-tile" />
                   <!-- Remote Hand Raised (We would need to parse metadata in tile, but simpler here if possible. For now, rely on tile handling or just basic video) -->
               </div>
           </div>

           <!-- Reaction Overlay -->
           <div class="absolute-bottom text-center q-mb-xl z-top pointer-events-none" style="bottom: 150px; left: 0; right: 0;">
               <transition-group name="fly-up" tag="div" class="row q-gutter-md justify-center">
                   <div v-for="r in recentReactions" :key="r.id" class="text-h2">{{ r.emoji }}</div>
                </transition-group>
           </div>

           <!-- Speaker View -->
           <div v-if="viewMode === 'speaker'" class="speaker-view full-width full-height column">
                <div class="active-speaker col relative-position overflow-hidden flex flex-center bg-black">
                    <div class="text-grey-6 text-h6">Active Speaker</div>
                </div>
                <!-- Strip -->
                <div class="row justify-center q-pa-md fixed-bottom z-top" style="bottom: 90px;">
                    <div class="strip-tile relative-position shadow-5" style="width: 180px; height: 100px; border-radius: 12px; overflow: hidden; border: 2px solid #292929; background: #111;">
                         <video ref="localVideoRefSpeaker" autoplay playsinline muted class="full-width full-height object-cover mirrored"></video>
                         <div class="name-tag">You</div>
                    </div>
                </div>
           </div>
           
           <!-- Empty State -->
           <div v-if="remoteParticipants.length === 0 && viewMode === 'gallery'" class="absolute-center text-center text-grey-5 group">
               <div class="text-h4 text-weight-thin q-mb-xl text-white">Waiting for others to join...</div>
               <div class="row q-gutter-xl justify-center opacity-hover">
                    <div class="column items-center cursor-pointer hover-scale" @click="copyMeetingLink">
                        <div class="bg-dark-glass q-pa-md rounded-circle q-mb-sm">
                             <q-icon name="person_add" size="32px" color="white" />
                        </div>
                        <div class="text-caption text-grey-4">Invite</div>
                        <q-tooltip>Copy Link</q-tooltip>
                    </div>
                     <div class="column items-center cursor-pointer hover-scale" @click="toggleScreenShare">
                        <div class="bg-dark-glass q-pa-md rounded-circle q-mb-sm">
                             <q-icon name="ios_share" size="32px" color="green-4" />
                        </div>
                        <div class="text-caption text-grey-4">Share Screen</div>
                    </div>
               </div>
           </div>

       </div>

       <!-- Right Sidebar (Premium Dark) -->
       <transition name="slide-right">
           <div v-if="isRightPanelOpen" class="right-panel col-auto bg-dark-surface border-left column" style="width: 350px;">
                <div class="q-pa-md row justify-between items-center text-white border-bottom-dark">
                    <div class="text-h6 text-weight-bold">{{ activePanel }}</div>
                    <q-btn flat round icon="close" size="sm" color="grey-5" @click="isRightPanelOpen = false" />
                </div>

                <div class="panel-content col scroll q-pa-md">
                    <div v-if="activePanel === 'Participants'">
                        <q-list dark separator class="rounded-borders">
                            <!-- Me -->
                            <q-item class="bg-layer q-mb-sm rounded-borders">
                                <q-item-section avatar>
                                    <q-avatar color="primary" text-color="white" size="md">{{ userName.charAt(0).toUpperCase() }}</q-avatar>
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label class="text-white text-weight-bold">{{ userName }} <span class="text-grey-5">(Me)</span></q-item-label>
                                </q-item-section>
                                <q-item-section side>
                                    <div class="row q-gutter-sm">
                                        <q-icon :name="isMicEnabled ? 'mic' : 'mic_off'" size="xs" :color="isMicEnabled ? 'white' : 'negative'" />
                                        <q-icon :name="isCameraEnabled ? 'videocam' : 'videocam_off'" size="xs" :color="isCameraEnabled ? 'white' : 'negative'" />
                                    </div>
                                </q-item-section>
                            </q-item>
                            <!-- Remote List -->
                            <q-item v-for="p in remoteParticipants" :key="p.identity" class="bg-layer q-mb-sm rounded-borders">
                                <q-item-section avatar>
                                    <q-avatar color="blue-grey-8" text-color="white" size="md">{{ p.identity.charAt(0).toUpperCase() }}</q-avatar>
                                </q-item-section>
                                <q-item-section>
                                    <q-item-label class="text-white text-weight-bold">{{ p.identity }}</q-item-label>
                                </q-item-section>
                                <q-item-section side>
                                    <q-icon name="mic" size="xs" color="grey-5" />
                                    <q-icon name="videocam" size="xs" color="grey-5" />
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </div>
                    <!-- Chat Panel -->
                    <div v-else-if="activePanel === 'Chat'" class="column full-height">
                        <div class="col flex flex-center text-grey-6">
                            No messages yet.
                        </div>
                    </div>
                </div>
                 <!-- Chat Input -->
                <div v-if="activePanel === 'Chat'" class="q-pa-md border-top-dark">
                    <q-input dark dense outlined v-model="chatMessage" placeholder="Type a message..." @keyup.enter="chatMessage = ''">
                        <template v-slot:after>
                            <q-btn round flat icon="send" color="primary" />
                        </template>
                    </q-input>
                </div>
           </div>
       </transition>

    </div>

    <!-- Premium Bottom Toolbar (Floating Dark) -->
    <div class="zoom-toolbar row justify-between items-center q-px-xl z-top">
        
        <!-- Left: Local Controls -->
        <div class="row q-gutter-lg">
            <div class="column flex-center cursor-pointer control-btn" @click="toggleMic">
                <div class="icon-circle" :class="{ 'bg-active': !isMicEnabled }">
                    <q-icon :name="isMicEnabled ? 'mic' : 'mic_off'" :color="isMicEnabled ? 'white' : 'white'" size="24px" />
                </div>
                <span class="toolbar-text">{{ isMicEnabled ? 'Mute' : 'Unmute' }}</span>
            </div>

            <div class="column flex-center cursor-pointer control-btn" @click="toggleCamera">
                 <div class="icon-circle" :class="{ 'bg-active': !isCameraEnabled }">
                    <q-icon :name="isCameraEnabled ? 'videocam' : 'videocam_off'" :color="isCameraEnabled ? 'white' : 'white'" size="24px" />
                 </div>
                 <span class="toolbar-text">{{ isCameraEnabled ? 'Stop Video' : 'Start Video' }}</span>
            </div>
        </div>

        <!-- Center: Interaction Controls -->
        <div class="row q-gutter-xl absolute-center">
             <div class="column flex-center cursor-pointer control-btn" @click="togglePanel('Participants')">
                <div class="relative-position">
                    <q-icon name="group" size="28px" :color="(isRightPanelOpen && activePanel === 'Participants') ? 'primary' : 'grey-4'" />
                    <q-badge color="red" floating rounded v-if="remoteParticipants.length > 0" class="badge-mini">{{ remoteParticipants.length + 1 }}</q-badge>
                </div>
                <span class="toolbar-text" :class="{ 'text-primary': (isRightPanelOpen && activePanel === 'Participants') }">Participants</span>
            </div>

            <div class="column flex-center cursor-pointer control-btn" @click="togglePanel('Chat')">
                 <q-icon name="chat" size="26px" :color="(isRightPanelOpen && activePanel === 'Chat') ? 'primary' : 'grey-4'" />
                 <span class="toolbar-text" :class="{ 'text-primary': (isRightPanelOpen && activePanel === 'Chat') }">Chat</span>
            </div>

             <div class="column flex-center cursor-pointer control-btn" @click="toggleScreenShare">
                 <q-icon name="ios_share" size="26px" :color="isScreenSharing ? 'negative' : 'green-4'" />
                 <span class="toolbar-text text-green-4">{{ isScreenSharing ? 'Stop Share' : 'Share Screen' }}</span>
            </div>

             <div class="column flex-center cursor-pointer control-btn" @click="toggleHandRaise">
                 <q-icon name="back_hand" size="26px" :color="localHandRaised ? 'warning' : 'grey-4'" />
                 <span class="toolbar-text">Raise Hand</span>
            </div>

             <div class="column flex-center cursor-pointer control-btn">
                 <q-icon name="sentiment_satisfied_alt" size="26px" color="grey-4" />
                 <span class="toolbar-text">Reactions</span>
                 <q-menu dark anchor="top middle" self="bottom middle" :offset="[0, 10]">
                     <div class="row q-pa-sm q-gutter-md bg-dark-glass">
                          <q-btn flat round size="md" @click="sendReaction('👍')">👍</q-btn>
                          <q-btn flat round size="md" @click="sendReaction('❤️')">❤️</q-btn>
                          <q-btn flat round size="md" @click="sendReaction('👏')">👏</q-btn>
                          <q-btn flat round size="md" @click="sendReaction('🎉')">🎉</q-btn>
                          <q-btn flat round size="md" @click="sendReaction('😂')">😂</q-btn>
                     </div>
                 </q-menu>
            </div>
        </div>

        <!-- Right: End Button -->
        <div>
            <q-btn label="End" color="red-9" unelevated class="text-weight-bold rounded-borders q-px-lg" @click="leaveCall" />
        </div>

    </div>

  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from 'stores/roomStore'
import { storeToRefs } from 'pinia'
import ParticipantTile from 'components/ParticipantTile.vue'

// Setup
const store = useRoomStore()
const route = useRoute()
const router = useRouter()
const { isMicEnabled, isCameraEnabled, remoteParticipants } = storeToRefs(store)

const localVideoRef = ref(null)
const localVideoRefSpeaker = ref(null) 

const roomId = route.query.id || 'Meeting'
const userName = route.query.name || 'User'

const viewMode = ref('gallery')
const isRightPanelOpen = ref(false)
const activePanel = ref('Participants') 
const chatMessage = ref('')
const isScreenSharing = ref(false)
const localHandRaised = ref(false)
const recentReactions = ref([])

function togglePanel(panelName) {
    if (isRightPanelOpen.value && activePanel.value === panelName) {
        isRightPanelOpen.value = false;
    } else {
        isRightPanelOpen.value = true;
        activePanel.value = panelName;
    }
}

function copyMeetingLink() {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    // could use notify plugin here
}

function toggleScreenShare() {
    store.toggleScreenShare()
}

function toggleHandRaise() {
    localHandRaised.value = !localHandRaised.value
    store.toggleHandRaise()
}

function sendReaction(emoji) {
    store.sendReaction(emoji)
    // Show local reaction too
    showReaction({ emoji, id: Date.now() })
}

function showReaction(reaction) {
    recentReactions.value.push(reaction)
    setTimeout(() => {
        recentReactions.value = recentReactions.value.filter(r => r.id !== reaction.id)
    }, 2000)
}

onMounted(async () => {
    // 1. Initialize Camera/Mic
    const success = await store.initializeLocalTracks()
    if (success && store.localVideoTrack) {
        store.localVideoTrack.attach(localVideoRef.value)
    }

    // 2. Connect to Real Room
    await store.joinRoom(roomId, userName)
    
    // 3. Listen for Data (Reactions)
    if (store.room) {
        store.room.on('dataReceived', (payload) => {
             const str = new TextDecoder().decode(payload)
             try {
                 const data = JSON.parse(str)
                 if (data.type === 'reaction') {
                     showReaction({ emoji: data.emoji, id: Date.now() })
                 }
             } catch {
                 // ignore invalid data
             }
        })
    }
})

watch(viewMode, (newMode) => {
    if (newMode === 'gallery') {
         setTimeout(() => { store.localVideoTrack?.attach(localVideoRef.value) }, 100)
    } else {
        setTimeout(() => { store.localVideoTrack?.attach(localVideoRefSpeaker.value) }, 100)
    }
})

onUnmounted(() => {
    store.leaveRoom()
})

function toggleMic() { store.toggleMic() }
function toggleCamera() { store.toggleCamera() }
function leaveCall() { 
    store.leaveRoom()
    router.push('/') 
}
</script>

<style scoped>
.room-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #000;
    overflow: hidden;
}

.main-area {
    flex: 1;
    overflow: hidden; 
}

/* Premium Dark Toolbar */
.zoom-toolbar {
    height: 88px;
    background: #121212; /* Dark background */
    border-top: 1px solid #333;
}

.video-area {
    background-color: #000000;
}

/* Gallery Grid */
.gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    grid-auto-rows: minmax(200px, 1fr);
    gap: 16px;
    align-content: center;
    max-width: 100%;
}

.video-tile {
    background: #1E1E1E;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    aspect-ratio: 16/9;
    border: 1px solid #333;
    transition: all 0.2s;
}

.video-feed {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.mirrored { transform: scaleX(-1); }

.name-tag {
    position: absolute;
    bottom: 8px;
    left: 8px;
    color: white;
    background: rgba(0,0,0,0.7);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
}

/* Controls */
.control-btn {
    min-width: 65px;
    padding: 8px;
    transition: opacity 0.2s;
}

.control-btn:hover {
    opacity: 0.8;
}

.icon-circle {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 32px;
    width: 32px;
    border-radius: 50%;
}

.bg-active {
    background: rgba(255, 255, 255, 0.1);
}

.toolbar-text {
    font-size: 11px;
    color: #B0B0B0;
    font-weight: 500;
    margin-top: 6px;
}

.text-primary { color: #29B6F6 !important; }

/* Side Panel */
.bg-dark-surface { background: #1a1a1a; }
.border-bottom-dark { border-bottom: 1px solid #333; }
.bg-layer { background: #2a2a2a; }

/* Glass Effects for floating elements */
.glass-effect {
    background: rgba(40, 40, 40, 0.6);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.bg-dark-glass {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 16px;
}

.hover-scale:hover {
    transform: scale(1.1);
    transition: transform 0.2s;
}

.opacity-hover {
    transition: opacity 0.3s;
}
.group:hover .opacity-hover {
    opacity: 1;
}

/* Transition */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.fly-up-enter-active {
  transition: all 1s ease-out;
}
.fly-up-leave-active {
  transition: all 1s ease-in;
}
.fly-up-enter-from {
  transform: translateY(20px);
  opacity: 0;
}
.fly-up-leave-to {
  transform: translateY(-100px);
  opacity: 0;
}

.pointer-events-none {
  pointer-events: none;
}
</style>
