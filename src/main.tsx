import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ScheduledPopup } from './ScheduledPopup';
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get('mode') === 'scheduled' ? <ScheduledPopup /> : <App />}
  </React.StrictMode>
);
