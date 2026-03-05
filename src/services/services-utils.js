function getServerURL() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  return "http://localhost:8301";
}

async function getJsonResponse(response) {
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error(response.statusText);
  }
}

async function getTextResponse(response) {
  if (response.ok) {
    return await response.text();
  } else {
    throw new Error(response.statusText);
  }
}

export { getServerURL, getJsonResponse, getTextResponse };
