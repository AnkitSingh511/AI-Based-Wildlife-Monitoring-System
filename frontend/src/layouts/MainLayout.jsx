import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

/* ==========================================================================
   3. MAIN LAYOUT SHELL
   ========================================================================== */
function MainLayout() {
  return (
    <div
      className="d-flex flex-column min-vh-100"
      style={{ backgroundColor: "var(--bg-dark)" }}
    >
      <Navbar />

      <main className="flex-grow-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export default MainLayout;