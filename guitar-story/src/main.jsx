import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import "./css/index.css";
import App from "./App.jsx";

// Use HashRouter when running on GitHub Pages (served from a static file server with no rewrites),
// otherwise use BrowserRouter (e.g. on Vercel or other hosts with SPA rewrites configured).
const isGitHubPages =
  window.location.hostname === "github.io" ||
  window.location.hostname.endsWith(".github.io");

const Router = isGitHubPages ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>
);
