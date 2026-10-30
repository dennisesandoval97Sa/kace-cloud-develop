export const validateError = (error = null) => {
  if (!error) {
    return;
  }

  if (error.response?.data) {
    const errorData = error.response.data;
    let isFingerPrintError = false;

    if (typeof errorData?.message === 'string') {
      isFingerPrintError = errorData.message
        ?.toLowerCase()
        .includes('fingerprint');
    }

    if (typeof errorData?.errors === 'string') {
      if (errorData.errors.toLowerCase().includes('INACTIVE USER')) {
        return new Error(errorData.errors);
      }

      isFingerPrintError = errorData.errors
        ?.toLowerCase()
        .includes('fingerprint');
    }

    if (Array.isArray(errorData?.errors)) {
      isFingerPrintError = errorData.errors.some(
        (err) => err.message?.toLowerCase().includes('fingerprint') || false
      );
    }

    if (isFingerPrintError) {
      const onAuthRoute = /^\/auth(\/|$)/.test(window.location.pathname);
      if (!onAuthRoute) {
        localStorage.setItem('lastURL', window.location.pathname);
        window.location.replace('/auth');
      }
      return new Error('Fingerprint conflict: otra sesión ya está activa.');
    }
  }
};
