import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";

import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import ToastHost from "./components/common/ToastHost.jsx";

// ✅ fichier en JSX (OK)
import { AuthProvider } from "./context/AuthContext.jsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppWrapper>
          <App />
          <ToastHost />
        </AppWrapper>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
