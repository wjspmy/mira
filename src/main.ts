import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles/editor.css";
import "katex/dist/katex.min.css";
import App from "./App.vue";

createApp(App).use(createPinia()).mount("#app");
