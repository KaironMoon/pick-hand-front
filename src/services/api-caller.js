import axios from "axios";

function getUrl(baseUrl, url) {
  if (url.indexOf("http") === -1) {
    let fullUrl = baseUrl + url;
    if (url.length > 0 && url[0] === "/" && baseUrl.length > 0 && baseUrl[baseUrl.length - 1] === "/") {
      fullUrl = baseUrl + url.substr(1);
    }
    return fullUrl;
  }
  return url;
}

class ApiCaller {
  constructor({ baseUrl, timeout }) {
    this._baseUrl = baseUrl;

    this._axiosInstance = axios.create({
      timeout: timeout,
    });
  }

  get axiosInstance() {
    return this._axiosInstance;
  }

  get baseUrl() {
    return this._baseUrl || "";
  }

  /**
   * HTTP GET
   * @param  {String} url
   * @param  {Object} [params]
   * @returns {Promise}
   */
  get(url, params, config = {}) {
    return this._axiosInstance.get(getUrl(this.baseUrl, url), {
      params: params || {},
      ...config,
    });
  }

  /**
   * HTTP POST
   * @param  {String} url
   * @param  {Object} data
   * @returns {Promise}
   */
  post(url, data, config = {}) {
    return this._axiosInstance.post(getUrl(this.baseUrl, url), data || {}, {
      ...config,
    });
  }

  /**
   * HTTP PUT
   * @param  {String} url
   * @param  {Object} [data]
   */
  put(url, data, config = {}) {
    return this._axiosInstance.put(getUrl(this.baseUrl, url), data || {}, {
      ...config,
    });
  }

  /**
   * HTTP DELETE
   * @param  {String} url
   * @param  {Object} [params]
   */
  delete(url, params, config = {}) {
    return this._axiosInstance.delete(getUrl(this.baseUrl, url), {
      params: params || {},
      ...config,
    });
  }

  /**
   * 파일 업로드
   * @param  {String} url
   * @param  {FormData} formData
   * @param  {Function} [onUploadProgress] (e) => { let progress = Math.round((e.loaded * 100) / e.total) }
   */
  upload(url, formData, onUploadProgress = null) {
    let options = {
      headers: {
        "content-type": "multipart/form-data",
      },
    };

    if (onUploadProgress) {
      options.onUploadProgress = onUploadProgress;
    }

    return this._axiosInstance.post(getUrl(this.baseUrl, url), formData, options);
  }

  /**
   * 파일 다운로드
   * @param  {String} url
   * @param  {Function} [onDownloadProgress] (e) => { let progress = Math.round((e.loaded * 100) / e.total) }
   */
  download(url, onDownloadProgress) {
    let config = !!onDownloadProgress === true ? { onDownloadProgress } : {};
    config = {
      ...config,
      responseType: "stream",
      params: {},
    };

    return this._axiosInstance.get(getUrl(this.baseUrl, url), { ...config });
  }
}

class ApiInterceptors {
  _axiosInstance = null;
  _interceptors = null;

  _instanceInterceptor = {
    request: null,
    response: null,
  };

  constructor(apiCaller) {
    this._axiosInstance = apiCaller.axiosInstance;
    this._interceptors = apiCaller.axiosInstance.interceptors;
  }

  start() {
    this._instanceInterceptor.request = this._interceptors.request.use(
      (config) => {
        console.log("%cHTTP REQUEST %s\n", "color: blue", config.url, config);

        return config;
      },
      (error) => {
        console.warn("%cHTTP REQUEST ERROR\n", "color: red", error);

        return Promise.reject(error);
      },
    );

    this._instanceInterceptor.response = this._interceptors.response.use(
      (response) => {
        console.log("%cHTTP RESPONSE %s\n", "color: blue", response.config.url, response);

        return response;
      },
      (error) => {
        console.warn("%cHTTP RESPONSE ERROR\n%s", "color: red", error);

        return Promise.reject(error);
      },
    );
  }

  stop() {
    this._instanceInterceptor.request && this._interceptors.request.eject(this._instanceInterceptor.request);
    this._instanceInterceptor.response && this._interceptors.response.eject(this._instanceInterceptor.response);
  }
}

const apiCaller = new ApiCaller({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  timeout: import.meta.env.VITE_API_TIMEOUT || 10000,
});
const apiInterceptors = new ApiInterceptors(apiCaller);

apiInterceptors.start();

export { ApiCaller, ApiInterceptors };

export default apiCaller;
