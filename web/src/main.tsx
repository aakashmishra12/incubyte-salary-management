import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { createQueryClient } from './api/queryClient.ts';
import { App } from './App.tsx';
import { theme } from './theme.ts';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

const queryClient = createQueryClient();

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
