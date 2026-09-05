export async function syncUserWithBackend(email: string, phone_number?: string, fullName?: string) {
  try {
    // Goes through the session-gated proxy; the proxy overwrites `email`
    // with the signed-in user's email, so callers cannot sync as someone else.
    const response = await fetch(`/api/backend/user/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        phone_number,
        fullName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed with status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to sync user with backend:', error);
    throw error;
  }
}
