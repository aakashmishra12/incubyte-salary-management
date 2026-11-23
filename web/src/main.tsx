import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.tsx';
import { theme } from './theme.ts';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

// One cache for all server data, shared by every page.
const queryClient = new QueryClient();

createRoot(root).render(
  <StrictMode>
    {/* The theme gives every MUI component the design in docs/design/DESIGN.md. */}
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
