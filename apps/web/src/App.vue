<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  darkTheme,
  zhCN,
  dateZhCN,
} from "naive-ui";
import AppShell from "@/layouts/AppShell.vue";

const themeOverrides = {
  common: {
    primaryColor: "#e8a54b",
    primaryColorHover: "#f0b45c",
    primaryColorPressed: "#c4842f",
    bodyColor: "#121410",
    cardColor: "#1a1f18",
    modalColor: "#1a1f18",
    popoverColor: "#242b22",
    textColorBase: "#f2efe6",
    textColor1: "#f2efe6",
    textColor2: "#a7b0a0",
    textColor3: "#8a9480",
    borderColor: "rgba(232, 165, 75, 0.22)",
    dividerColor: "rgba(232, 165, 75, 0.12)",
    inputColor: "#242b22",
    hoverColor: "rgba(232, 165, 75, 0.12)",
    fontFamily: 'var(--font-ui)',
  },
};
</script>

<template>
  <n-config-provider
    :theme="darkTheme"
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
