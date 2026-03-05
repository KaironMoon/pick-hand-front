import { getServerURL, getJsonResponse } from "./services-utils";
/* 예
httpGet /Sample/{id}
httpGet /Samples?page=1&size=10
httpPost /Sample
httpPut /Sample/{id}
httpDelete /Sample/{id}
*/

const sampleServices = {
  httpMethodAPIUrl: async () => {
    const response = await getJsonResponse(
      fetch(`${getServerURL()}/api/v1/sample`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    return response;
  },
  getSample: async (id) => {
    const response = await fetch(`${getServerURL()}/api/v1/sample/${id}`, {
      method: "GET",
    }).then((r) => {
      return r.json();
    });

    return response;
  },
  getSamples: async (page, size) => {
    const response = await fetch(`${getServerURL()}/samples?page=${page}&size=${size}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((r) => {
      return r.json();
    });

    return response;
  },
  postSample: async (data) => {
    const response = await fetch(`${getServerURL()}/api/v1/sample`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }).then((r) => {
      return r.json();
    });
    return response;
  },
  putSample: async (id, data) => {
    const response = await fetch(`${getServerURL()}/api/v1/sample/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }).then((r) => {
      return r.json();
    });
    return response;
  },
  deleteSample: async (id) => {
    const response = await fetch(`${getServerURL()}/api/v1/sample/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((r) => {
      return r.json();
    });
    return response;
  },
};

export default sampleServices;
