import { Alert, Container, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { isApiReachable } from './api.ts';

type ApiStatus = 'checking' | 'reachable' | 'unreachable';

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    // If the component is removed before the answer arrives, ignore the answer.
    let ignore = false;
    isApiReachable().then((reachable) => {
      if (!ignore) setApiStatus(reachable ? 'reachable' : 'unreachable');
    });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Salary Management
      </Typography>
      {apiStatus === 'checking' && <Alert severity="info">Checking the API</Alert>}
      {apiStatus === 'reachable' && <Alert severity="success">API is reachable</Alert>}
      {apiStatus === 'unreachable' && <Alert severity="error">Cannot reach the API</Alert>}
    </Container>
  );
}
