
import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import DetectionsPage from "./pages/DetectionsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFoundPage from "./pages/NotFoundPage";
import { AuthProvider } from "./context/AuthContext";

/* ========================================================================== 
   MAIN APP COMPONENT (ROOT ROUTER)
   ========================================================================== */

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="detections" element={<DetectionsPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;






// import { BrowserRouter, Routes, Route } from "react-router-dom";

// // Layout
// import MainLayout from "./layouts/MainLayout";

// // Pages
// import LandingPage from "./pages/LandingPage";
// import DashboardPage from "./pages/DashboardPage";
// import DetectionsPage from "./pages/DetectionsPage";
// import LoginPage from "./pages/LoginPage";
// import RegisterPage from "./pages/RegisterPage";
// import NotFoundPage from "./pages/NotFoundPage";

// function App() {
//   return (
//     <BrowserRouter>
//       <Routes>
//         <Route path="/" element={<MainLayout />}>
          
//           <Route index element={<LandingPage />} />

//           <Route
//             path="dashboard"
//             element={<DashboardPage />}
//           />

//           <Route
//             path="detections"
//             element={<DetectionsPage />}
//           />

//           <Route
//             path="login"
//             element={<LoginPage />}
//           />

//           <Route
//             path="register"
//             element={<RegisterPage />}
//           />

//           <Route
//             path="*"
//             element={<NotFoundPage />}
//           />

//         </Route>
//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;