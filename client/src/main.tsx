import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(reg => {
      // Check for updates every time the page loads
      reg.update();

      // When a new SW is waiting, show a refresh banner
      const showUpdateBanner = () => {
        const banner = document.createElement("div");
        banner.id = "sw-update-banner";
        banner.dir = "rtl";
        banner.style.cssText = [
          "position:fixed", "bottom:80px", "left:50%",
          "transform:translateX(-50%)", "z-index:99999",
          "background:#ef4444", "color:#fff",
          "padding:12px 20px", "border-radius:999px",
          "font-size:14px", "font-weight:700",
          "display:flex", "align-items:center", "gap:10px",
          "box-shadow:0 4px 24px rgba(0,0,0,.4)",
          "cursor:pointer", "white-space:nowrap",
          "font-family:system-ui,sans-serif",
        ].join(";");
        banner.innerHTML = "🔄 تحديث جديد متاح — اضغط لتحديث التطبيق";
        banner.onclick = () => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          window.location.reload();
        };
        document.body.appendChild(banner);
      };

      if (reg.waiting) {
        showUpdateBanner();
      }
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      // Reload when the new SW takes control
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!(window as any).__swReloading) {
          (window as any).__swReloading = true;
          window.location.reload();
        }
      });
    }).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
