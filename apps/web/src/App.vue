<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  zhCN,
  dateZhCN,
} from "naive-ui";
import AppShell from "@/layouts/AppShell.vue";

const themeOverrides = {
  common: {
    primaryColor: "#2f9b78",
    primaryColorHover: "#3aad88",
    primaryColorPressed: "#247a5e",
    bodyColor: "#eef8f3",
    cardColor: "#ffffff",
    modalColor: "#ffffff",
    popoverColor: "#ffffff",
    textColorBase: "#1c322c",
    textColor1: "#1c322c",
    textColor2: "#5f7a70",
    textColor3: "#7a9088",
    borderColor: "rgba(45, 140, 110, 0.18)",
    dividerColor: "rgba(45, 140, 110, 0.1)",
    inputColor: "#f3faf6",
    hoverColor: "rgba(47, 155, 120, 0.1)",
    fontFamily: "var(--font-ui)",
  },
};
</script>

<template>
  <n-config-provider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme-overrides="themeOverrides"
  >
    <n-message-provider>
      <n-dialog-provider>
        <AppShell />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
