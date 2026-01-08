<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-avatar>
          <q-icon name="videocam" size="md" />
        </q-avatar>
        <q-toolbar-title class="text-weight-bold"> Cloudy Meet </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
// No script needed for now as we removed the drawer logic
</script>
