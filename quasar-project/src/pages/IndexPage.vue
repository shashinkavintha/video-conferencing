<template>
  <q-page class="flex flex-center page-background">
    <div class="column items-center q-pa-lg fade-in" style="width: 100%; max-width: 500px">
      <!-- Logo / Title Section -->
      <div class="text-center q-mb-xl">
        <q-icon name="cloud" size="100px" color="primary" class="q-mb-md float" />
        <div class="text-h3 text-weight-bolder text-primary q-mb-sm">Cloudy Meet</div>
        <div class="text-subtitle1 text-grey-7">Premium Video Conferencing for Everyone</div>
      </div>

      <!-- Action Card -->
      <q-card class="full-width q-pa-lg shadow-6" style="border-radius: 20px">
        <q-card-section>
          <div class="text-h6 q-mb-md text-weight-bold text-center text-primary">Join a Meeting</div>
          
          <q-input
            filled
            v-model="userName"
            label="Your Name"
            class="q-mb-md"
            bg-color="grey-1"
            color="primary"
          >
            <template v-slot:prepend>
              <q-icon name="person" color="primary" />
            </template>
          </q-input>

          <q-input
            filled
            v-model="roomId"
            label="Room ID"
            class="q-mb-lg"
            bg-color="grey-1"
            color="primary"
          >
            <template v-slot:prepend>
              <q-icon name="meeting_room" color="primary" />
            </template>
          </q-input>

          <q-btn
            unelevated
            color="primary"
            size="lg"
            class="full-width text-weight-bold q-mb-md button-hover"
            label="Join Room"
            :disable="!canJoin"
            @click="joinRoom"
          />
          
          <div class="text-center q-my-sm text-grey-6">- OR -</div>

          <q-btn
            outline
            color="primary"
            size="lg"
            class="full-width text-weight-bold"
            label="Create New Meeting"
            @click="createRoom"
          />
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { uid } from 'quasar'

const router = useRouter()
const userName = ref('')
const roomId = ref('')

const canJoin = computed(() => {
  return userName.value.trim().length > 0 && roomId.value.trim().length > 0
})

function joinRoom() {
  if (!canJoin.value) return 

  router.push({ 
    path: '/room', 
    query: { id: roomId.value, name: userName.value }
  })
}

function createRoom() {
  const newId = uid().slice(0, 8) 
  roomId.value = newId
  
  // Auto-fill name if empty (optional, better UX)
  if (!userName.value) {
    userName.value = `Host-${Math.floor(Math.random() * 1000)}`
  }

  // Navigate immediately
  joinRoom()
}
</script>

<style scoped>
.page-background {
  background: linear-gradient(135deg, #E1F5FE 0%, #FFFFFF 100%);
}

.fade-in {
  animation: fadeIn 0.8s ease-out;
}

.float {
  animation: float 3s ease-in-out infinite;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

.button-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(3, 169, 244, 0.4);
}
</style>
