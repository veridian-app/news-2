import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMixpanel } from "./lib/mixpanel";

initMixpanel();

createRoot(document.getElementById("root")!).render(<App />);
