import { Route, Routes } from "react-router-dom";
import "./App.css";
import { Navbar, Footer, Home, NotFound, Dashboard } from "./components";

import DetectTranslatePage from "./pages/DetectTranslatePage";
import DetectPracticePage from "./pages/DetectPracticePage";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const notifyMsg = (type, msg) => {
  if (type === "success") {
    const notify = () => toast.success(msg);
    notify();
  } else {
    const notify = () => toast.error(msg);
    notify();
  }
};

const Layout = ({ children }) => {
  return (
    <>
      <Navbar notifyMsg={notifyMsg} />
      {children}
      <Footer />
    </>
  );
};

function App() {
  return (
    <div className="App">
      <Routes>
        <Route
          path="/"
          element={
            <Layout notifyMsg={notifyMsg}>
              <Home />
            </Layout>
          }
        />

        {/* TRANSLATE */}
        <Route
          path="/detect"
          element={
            <Layout>
              <DetectTranslatePage />
            </Layout>
          }
        />

        {/* PRACTICE */}
        <Route
          path="/practice"
          element={
            <Layout>
              <DetectPracticePage />
            </Layout>
          }
        />

        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>

      <ToastContainer
        position="top-left"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
      />
    </div>
  );
}

export default App;
