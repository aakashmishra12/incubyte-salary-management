import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Link, Route, Routes } from 'react-router';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage.tsx';
import { EmployeesPage } from './pages/EmployeesPage.tsx';
import { InsightsPage } from './pages/InsightsPage.tsx';
import { NewEmployeePage } from './pages/NewEmployeePage.tsx';

/** The frame around every page: the top bar, and the page that matches the address. */
export function App() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ mr: 4 }}>
            Salary Management
          </Typography>
          <Button color="inherit" component={Link} to="/">
            Employees
          </Button>
          <Button color="inherit" component={Link} to="/insights">
            Insights
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" component="main" sx={{ py: 3 }}>
        <Routes>
          <Route path="/" element={<EmployeesPage />} />
          <Route path="/employees/new" element={<NewEmployeePage />} />
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<Typography>This page does not exist.</Typography>} />
        </Routes>
      </Container>
    </Box>
  );
}
