import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { reloadOnceForStaleChunk } from "./utils/lazyWithRetry";
import "./locale/i18n.js";
import "./index.css";

window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadOnceForStaleChunk();
});

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
