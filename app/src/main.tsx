import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useBookings } from './store/bookings';
import { useClosures } from './store/closures';
import { usePromemoria } from './store/promemoria';
import { MOCK_BOOKINGS, MOCK_CLOSURES, MOCK_PROMEMORIA } from './data/mock';

if (useBookings.getState().items.length === 0) useBookings.setState({ items: MOCK_BOOKINGS });
if (useClosures.getState().items.length === 0) useClosures.setState({ items: MOCK_CLOSURES });
if (usePromemoria.getState().items.length === 0) usePromemoria.setState({ items: MOCK_PROMEMORIA });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
