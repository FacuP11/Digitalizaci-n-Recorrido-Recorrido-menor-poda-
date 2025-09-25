import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css"; // Asegurate que acá importás Tailwind (ver paso 4)
import RecorridosList from "./pages/RecorridosList.jsx";
import NuevoRecorrido from "./pages/NuevoRecorrido.jsx";
import PiquetesList from "./pages/PiquetesList.jsx";
import PiqueteForm from "./pages/PiqueteForm.jsx";
import UIExamples from "./components/UIExamples.jsx";

const router = createBrowserRouter([
  { path: "/", element: <RecorridosList /> },
  { path: "/recorridos/nuevo", element: <NuevoRecorrido /> },
  { path: "/recorridos/:id/piquetes", element: <PiquetesList /> },
  { path: "/piquetes/:piqueteId", element: <PiqueteForm /> },
  { path: "/ui", element: <UIExamples /> }, // <- demo de UI
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
