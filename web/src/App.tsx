import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Link, Route, Routes, useLocation } from 'react-router';
import { AssistantLauncher } from './components/assistant/AssistantLauncher.tsx';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage.tsx';
import { EmployeesPage } from './pages/EmployeesPage.tsx';
import { InsightsPage } from './pages/InsightsPage.tsx';
import { NewEmployeePage } from './pages/NewEmployeePage.tsx';

/** The frame around every page: the top bar, and the page that matches the address. */
export function App() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1 }}>
          <Typography
            component="div"
            sx={{ fontWeight: 600, letterSpacing: '-0.6px', fontSize: 18, mr: 3 }}
          >
            Salary Management
          </Typography>
          <NavLink to="/">Employees</NavLink>
          <NavLink to="/insights">Insights</NavLink>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" component="main" sx={{ py: 4 }}>
        <Routes>
          <Route path="/" element={<EmployeesPage />} />
          <Route path="/employees/new" element={<NewEmployeePage />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<Typography>This page does not exist.</Typography>} />
        </Routes>
      </Container>

      <AssistantLauncher />
    </Box>
  );
}

/** A link in the top bar. The section you are in is shown in ink, the others are quieter. */
function NavLink({ to, children }: { to: string; children: string }) {
  const { pathname } = useLocation();
  // Employee pages (/employees/42, /employees/new) belong to the Employees section.
  const isCurrent =
    to === '/' ? pathname === '/' || pathname.startsWith('/employees') : pathname.startsWith(to);

  return (
    <Button
      component={Link}
      to={to}
      aria-current={isCurrent ? 'page' : undefined}
      sx={{
        borderRadius: 9999,
        px: 1.5,
        color: isCurrent ? 'text.primary' : 'text.secondary',
        bgcolor: isCurrent ? 'action.hover' : 'transparent',
      }}
    >
      {children}
    </Button>
  );
}
