import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import "react-toastify/dist/ReactToastify.css";

import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { ToastContainer } from "react-toastify";

// ✅ fichier en JSX (OK)
import { AuthProvider } from "./context/AuthContext.jsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppWrapper>
          <ToastContainer position="top-right" newestOnTop limit={4} />
          <App />
        </AppWrapper>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
