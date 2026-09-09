import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Footer, Header, PageNotFound } from './components';
import { Home, RoomDetails } from './pages';
import { ChatProvider } from './context/ChatContext';
import { ChatWidget } from './components/Chatbot';

/**
 * Root app: router with Header/Footer and routes for Home, RoomDetails, and 404.
 * - BrowserRouter enables client-side routing (no full page reload on nav).
 * - future flags prepare for React Router v7 behavior (startTransition, relative splat paths).
 * - Header/Footer render on every route; Routes swap the main content by path.
 * - ChatProvider/ChatWidget: floating booking assistant, rendered on every route.
 */
function App() {
  return (
    <main className="">
      <ChatProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:id" element={<RoomDetails />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
          <Footer />
          <ChatWidget />
        </BrowserRouter>
      </ChatProvider>
    </main>
  );
}

export default App;