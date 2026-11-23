/** Asks the server whether it is up. Resolves to true only for a successful answer. */
export async function isApiReachable(): Promise<boolean> {
  try {
    const response = await fetch('/api/health');
    return response.ok;
  } catch {
    // fetch rejects when the network is down or the server refuses the connection.
    return false;
  }
}
